import { useEffect, useState } from "react";

import type {
    GameStateData,
    PlayerData,
    TeamData,
    TransferOfferData,
} from "../../store/gameStore";
import {
    makeTransferBid,
    previewTransferBidFinancialImpact,
    proposeTransferContract,
    type TransferBidProjectionData,
    type TransferNegotiationFeedbackData,
    type TransferNegotiationResponseData,
} from "../../services/transfersService";
import {
    buildResumedBidFeedback,
    getOutgoingNegotiationOffer,
} from "./TransfersTab.helpers";

interface UseTransferBidFlowArgs {
    gameState: GameStateData;
    onGameUpdate?: (game: GameStateData) => void;
}

interface UseTransferBidFlowResult {
    bidTarget: PlayerData | null;
    bidAmount: string;
    setBidAmount: (value: string) => void;
    contractWage: string;
    setContractWage: (value: string) => void;
    contractYears: string;
    setContractYears: (value: string) => void;
    contractStepActive: boolean;
    contractResult: TransferNegotiationResponseData["decision"] | "error" | null;
    bidResult: TransferNegotiationResponseData["decision"] | "error" | null;
    bidLoading: boolean;
    bidFeedback: TransferNegotiationFeedbackData | null;
    bidProjection: TransferBidProjectionData["projection"] | null;
    bidFee: number | null;
    activeBidOffer: TransferOfferData | null;
    myTeam: TeamData | null;
    hasExistingOffer: boolean;
    bidSubmitDisabled: boolean;
    contractSubmitDisabled: boolean;
    openBidNegotiation: (player: PlayerData) => void;
    closeBidNegotiation: () => void;
    handleMakeBid: () => Promise<void>;
    handleProposeContract: () => Promise<void>;
}

export function useTransferBidFlow({
    gameState,
    onGameUpdate,
}: UseTransferBidFlowArgs): UseTransferBidFlowResult {
    const userTeamId = gameState.manager.team_id;
    const myTeam = gameState.teams.find(
        (team) => team.id === gameState.manager.team_id,
    ) ?? null;
    const [bidTarget, setBidTarget] = useState<PlayerData | null>(null);
    const [bidAmount, setBidAmount] = useState("");
    const [bidResult, setBidResult] = useState<
        TransferNegotiationResponseData["decision"] | "error" | null
    >(null);
    const [bidLoading, setBidLoading] = useState(false);
    const [bidFeedback, setBidFeedback] =
        useState<TransferNegotiationFeedbackData | null>(null);
    const [contractWage, setContractWage] = useState("");
    const [contractYears, setContractYears] = useState("3");
    const [contractStepActive, setContractStepActive] = useState(false);
    const [contractResult, setContractResult] = useState<
        TransferNegotiationResponseData["decision"] | "error" | null
    >(null);
    const [bidProjection, setBidProjection] =
        useState<TransferBidProjectionData["projection"] | null>(null);

    const activeBidOffer = bidTarget
        ? getOutgoingNegotiationOffer(bidTarget, userTeamId)
        : null;
    const bidAmountMillions = Number.parseFloat(bidAmount);
    const bidFee = Number.isFinite(bidAmountMillions)
        ? Math.round(bidAmountMillions * 1_000_000)
        : null;

    useEffect(() => {
        if (!bidTarget || bidFee === null || bidFee <= 0) {
            setBidProjection(null);
            return;
        }

        let cancelled = false;

        const loadProjection = async (): Promise<void> => {
            try {
                const result = await previewTransferBidFinancialImpact(
                    bidTarget.id,
                    bidFee,
                );

                if (!cancelled) {
                    setBidProjection(result.projection ?? null);
                }
            } catch {
                if (!cancelled) {
                    setBidProjection(null);
                }
            }
        };

        void loadProjection();

        return () => {
            cancelled = true;
        };
    }, [bidFee, bidTarget]);

    const openBidNegotiation = (player: PlayerData): void => {
        const existingOffer = getOutgoingNegotiationOffer(player, userTeamId);

        setBidTarget(player);
        setBidAmount(
            (
                (existingOffer?.suggested_counter_fee ??
                    existingOffer?.fee ??
                    player.market_value) /
                1_000_000
            ).toFixed(existingOffer ? 2 : 1),
        );
        setBidResult(null);
        setBidFeedback(buildResumedBidFeedback(existingOffer));
        setContractWage(String(existingOffer?.wage_offered || player.wage || 1000));
        setContractYears(String(existingOffer?.contract_years || 3));
        setContractStepActive(existingOffer?.status === "Accepted");
        setContractResult(null);
        setBidProjection(null);
    };

    const closeBidNegotiation = (): void => {
        setBidTarget(null);
        setBidAmount("");
        setBidResult(null);
        setBidFeedback(null);
        setContractWage("");
        setContractYears("3");
        setContractStepActive(false);
        setContractResult(null);
        setBidProjection(null);
    };

    const handleMakeBid = async (): Promise<void> => {
        if (!bidTarget || bidFee === null || bidFee <= 0) {
            return;
        }

        setBidLoading(true);
        setBidResult(null);
        setBidFeedback(null);

        try {
            const response = await makeTransferBid(bidTarget.id, bidFee);
            setBidResult(response.decision);
            setBidFeedback(response.feedback);
            onGameUpdate?.(response.game);

            if (response.suggested_fee !== null) {
                setBidAmount((response.suggested_fee / 1_000_000).toFixed(2));
            }

            if (response.decision === "accepted") {
                const acceptedOffer = response.game.players
                    .find((player) => player.id === bidTarget.id)
                    ?.transfer_offers.find((offer) => (
                        offer.from_team_id === userTeamId && offer.status === "Accepted"
                    ));
                setContractStepActive(!response.is_terminal && Boolean(acceptedOffer));
                setContractWage(String(acceptedOffer?.wage_offered || bidTarget.wage || 1000));
                setContractYears(String(acceptedOffer?.contract_years || 3));

                if (response.is_terminal) {
                    setTimeout(() => {
                        closeBidNegotiation();
                    }, 2000);
                }
            }
        } catch (error: any) {
            setBidResult(error?.toString() || "error");
            setBidFeedback(null);
        } finally {
            setBidLoading(false);
        }
    };

    const handleProposeContract = async (): Promise<void> => {
        if (!bidTarget || !activeBidOffer || !contractWage || !contractYears) {
            return;
        }

        const weeklyWage = Math.round(Number.parseFloat(contractWage));
        const years = Math.round(Number.parseFloat(contractYears));
        if (!Number.isFinite(weeklyWage) || !Number.isFinite(years) || weeklyWage <= 0 || years <= 0) {
            return;
        }

        setBidLoading(true);
        setContractResult(null);
        setBidFeedback(null);

        try {
            const response = await proposeTransferContract(
                bidTarget.id,
                activeBidOffer.id,
                weeklyWage,
                years,
            );
            setContractResult(response.decision);
            setBidFeedback(response.feedback);
            onGameUpdate?.(response.game);

            if (response.suggested_wage !== null) {
                setContractWage(String(response.suggested_wage));
            }
            if (response.suggested_years !== null) {
                setContractYears(String(response.suggested_years));
            }
            if (response.decision === "accepted") {
                setTimeout(() => {
                    closeBidNegotiation();
                }, 2000);
            }
        } catch (error: any) {
            setContractResult(error?.toString() || "error");
        } finally {
            setBidLoading(false);
        }
    };

    return {
        bidTarget,
        bidAmount,
        setBidAmount,
        contractWage,
        setContractWage,
        contractYears,
        setContractYears,
        contractStepActive,
        contractResult,
        bidResult,
        bidLoading,
        bidFeedback,
        bidProjection,
        bidFee,
        activeBidOffer,
        myTeam,
        hasExistingOffer: activeBidOffer !== null,
        bidSubmitDisabled:
            bidLoading ||
            contractStepActive ||
            bidResult === "accepted" ||
            bidFee === null ||
            bidFee <= 0 ||
            bidProjection === null ||
            bidProjection.exceeds_transfer_budget ||
            bidProjection.exceeds_finance,
        contractSubmitDisabled:
            bidLoading ||
            !contractStepActive ||
            contractResult === "accepted" ||
            Number.parseFloat(contractWage) <= 0 ||
            Number.parseFloat(contractYears) <= 0,
        openBidNegotiation,
        closeBidNegotiation,
        handleMakeBid,
        handleProposeContract,
    };
}