import type { PlayerData } from "../../store/gameStore";

type TranslateFn = (key: string) => string;

export interface PlayerAttributeEntry {
    name: string;
    value: number;
}

export interface PlayerAttributeGroup {
    label: string;
    attrs: PlayerAttributeEntry[];
    average: number;
}

function createAttributeGroup(
    label: string,
    attrs: PlayerAttributeEntry[],
): PlayerAttributeGroup {
    return {
        label,
        attrs,
        average: Math.round(
            attrs.reduce((sum, attribute) => sum + attribute.value, 0) / attrs.length,
        ),
    };
}

export function buildPlayerAttributeGroups(
    player: PlayerData,
    translate: TranslateFn,
): PlayerAttributeGroup[] {
    const groups: PlayerAttributeGroup[] = [
        createAttributeGroup(translate("common.attrGroups.physical"), [
            { name: translate("common.attributes.pace"), value: player.attributes.pace },
            {
                name: translate("common.attributes.stamina"),
                value: player.attributes.stamina,
            },
            {
                name: translate("common.attributes.strength"),
                value: player.attributes.strength,
            },
            {
                name: translate("common.attributes.agility"),
                value: player.attributes.agility,
            },
        ]),
        createAttributeGroup(translate("common.attrGroups.technical"), [
            {
                name: translate("common.attributes.passing"),
                value: player.attributes.passing,
            },
            {
                name: translate("common.attributes.shooting"),
                value: player.attributes.shooting,
            },
            {
                name: translate("common.attributes.tackling"),
                value: player.attributes.tackling,
            },
            {
                name: translate("common.attributes.dribbling"),
                value: player.attributes.dribbling,
            },
            {
                name: translate("common.attributes.defending"),
                value: player.attributes.defending,
            },
        ]),
        createAttributeGroup(translate("common.attrGroups.mental"), [
            {
                name: translate("common.attributes.positioning"),
                value: player.attributes.positioning,
            },
            {
                name: translate("common.attributes.vision"),
                value: player.attributes.vision,
            },
            {
                name: translate("common.attributes.decisions"),
                value: player.attributes.decisions,
            },
            {
                name: translate("common.attributes.composure"),
                value: player.attributes.composure,
            },
            {
                name: translate("common.attributes.aggression"),
                value: player.attributes.aggression,
            },
            {
                name: translate("common.attributes.teamwork"),
                value: player.attributes.teamwork,
            },
            {
                name: translate("common.attributes.leadership"),
                value: player.attributes.leadership,
            },
        ]),
    ];

    if (player.position === "Goalkeeper") {
        groups.push(
            createAttributeGroup(translate("common.attrGroups.goalkeeper"), [
                {
                    name: translate("common.attributes.handling"),
                    value: player.attributes.handling,
                },
                {
                    name: translate("common.attributes.reflexes"),
                    value: player.attributes.reflexes,
                },
                {
                    name: translate("common.attributes.aerial"),
                    value: player.attributes.aerial,
                },
            ]),
        );
    }

    return groups;
}