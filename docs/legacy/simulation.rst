Match Simulation in Openfootmanager
===================================

Simulating a football/soccer match is not an easy task.

There are numerous different approaches and many things to consider
while trying to get it right.

In this article, I will talk about the efforts to simulate soccer matches in Openfoot Manager (OFM),
and I will go over what I eventually settled with for the game.

Previous attempts
=================

Before OFM, I had a project called `eSports Manager <https://github.com/sturdy-robot/esports-manager>`_, which I'm still
working on, and this project has basically the same idea: a manager game, but for eSports instead of soccer.

On eSports Manager, you control an eSports team and play matches, and just like OFM, you get live descriptions of what
is happening in the game.

I loved this kind of approach. It was something that I saw in Football Manager, Championship Manager and on Bygfoot.
Naturally, I wanted my game to also show me what was going on at every point in the game.

For eSports, it was a real challenge to come up with some way to simulate the game, and at one point I thought: maybe
simulating soccer is way easier than this, because in soccer you only have what's going on with the ball at all times.
In eSports, there are multiple things going on at the same time, how the heck am I going to simulate all of that?

In fact, it ended up being easier than I thought.

Initially, I was focusing on simulating MOBA matches, based on League of Legends. League has many stages of the game,
such as the laning phase, the objectives being taken, team fights happening, ganking lanes, 1v1, 2v2 or an uneven number
of fights between teams, there are even skirmishes happening in the early game. How do you actually account for all of
these different actions?

I decided to simplify things by a large margin, and that was the right approach to do.

I settled with a few main events in the game:

- Nothing
- Kill
- Jungle Objective
- Tower assault
- Inhibitor assault
- Nexus assault

I didn't have to account for team fights, I didn't have to consider many things happening at the same time in the game!
I just had to simplify: there were moments when nothing was going on in the game, and moments when intense fights happened.

I simplified it all down to these events in the game, and it worked wonders!

My approach was very simple:

- Before each game, you picked a champion for each player.
- Each player has their own skill level, and each champion also has a skill level.
- Players have their preferred champions, which we call a "Champion Pool". Players that play their preferred champions can extract more out of the champion's skill level. It's simple math: if a champion's skill is at 78, a player that has that champion in their champion pool can boost that to up to 30%. (In earlier stages, if a champion was not in their champion pool, they could only extract 50% of that champion's skill level, which could grow to 100%, but I thought that was a bad design choice, and changed it to boosting the champion's skill level instead).
- Each event had its own probability of happening. It's common that MOBA matches have nothing particular happening at any point, so the probability of Nothing was higher than others in the early game.
- As the game progresses, some events are unlocked. For example, the Tower assault event is only unlocked after 10 minutes, because it is not really common for teams to take a tower before that time. The inhibitor event is only unlocked after one team takes down the 3 towers from one lane. And the nexus event only comes up if an inhibitor is down and if the base towers are also down.
- Before each event, we calculate the probability of one team making the move over the other team. The probability is guided by each team skill level, which is calculated as the sum of each player + champion skill levels, divided by the sum of both teams skill levels. So whoever has more skill, has a higher chance of making the next move.
- Each event awards points to the teams. These points add up to the skill level, making the team stronger, and increasing their win probability.
- Even though there is no limit time for matches to end in LoL, with high probabilities for the Nexus event, eventually one team would take all the base towers down and win the game.

This is a very oversimplified overview of how I made that match simulation. I didn't talk about how I calculated kills,
or even how the events were calculated, that's not the focus here. That's just to show how you can simplify a complex
topic and model that into a simulation.

But what about soccer? Is it that easy?

I thought it was until I tried it.

Simulation approaches
=====================

In theory, soccer should be simpler. You have a ball, and only one player can have that ball at any point in time.
Nothing special should happen until you decide to shoot the ball into the opponent's goal.

But there's more to it than that: there are fouls, injuries, corner kicks, goal kicks, throw-ins, penalties, crosses...

How do you simplify that? Well, there are many different ways to do that.

Bygfoot, for example, has a simplistic approach to the whole situation. It maps each event in the game:

- General
- Foul
- Free kick
- Goal opportunity
- Lost possession
- Stadium events (some riot happening at the stadium)
- Penalty
- Substitution
- Corner kick
- Injury

The general event is the equivalent to "Nothing" in eSports Manager. Nothing in particular is happening at the game.

The other events are self-explanatory. This is very close to what I implemented in OFM. But there is a major difference:
Bygfoot tracks the teams differently. It does track which team is in possession at that moment, but it only has 3 fields:
DEFENSIVE, MIDFIELD, ATTACK.

So at each point, the game has to kind of make a guess where some event happened. For example, if a foul happened at the
attacking area, it has to decide if the offender was a defensive player or the attacking player, and it also has to decide
whether it happened at the penalty box or not.

Another key difference is that Bygfoot has 3 strategies: NORMAL, DEFENSIVE, ATTACK. Basically, they only tune the probabilities
of some events happening in your game, but don't necessarily change anything else.

Also, all the players on Bygfoot have only one skill overall. They don't have offensive and deffensive attributes. That's
a simple approach to the game, and is something that took me a while to understand while reading their code.

There is absolutely nothing wrong with that. Bygfoot works well even to this day, you can play full seasons on that game,
and you can get a blast playing it. But I wanted to go a little bit deeper.

Since the beginning I wanted OFM to be a little bit more detailed. If I play any soccer game, I will look
into each player's attributes and see what things they're good at. I'd love to see statistics for each game, and I would
like the game to be a little bit more realistic if I could ever do that.

So, Openfoot Manager's approach to simulation is similar, we have events just like Bygfoot, but they're mapped a little bit
differently:

- Pass
- Cross
- Dribble
- Foul
- Shot

These are the basic events that span everything in the game. There also a few additional events that happen under certain
conditions:

- Free Kick
- Corner Kick
- Goal Kick
- Penalty

Each event has a set of outcomes. For example, both Pass and Cross have the following outcomes:

- Success
- Miss
- Intercept
- Offside

Shots, for example, can result in one of the following outcomes:

- Blocked
- Blocked and return to the team in possession
- Blocked and change possession
- Saved
- Saved and secured by the keeper
- Saved and trigger a left or right corner kick
- Trigger a corner kick
- Hit the post
- Hit the post and change possession
- Hit the post and go out
- Miss
- Goal

You get the idea.

And differently from Bygfoot, the game tracks the position of the ball on the field more accurately.
There are fifteen different field positions, dividing the pitch into the offensive and defensive boxes, left and right
of both boxes, left, right and center defensive and offensive midfields, and the neutral left, right and center midfield areas.

When you have so many states, you must have state transitions, and that is a job for a transition matrix. The
transition matrix tells the game how likely is it to go from one region of the field to another.

The game's transition matrices are defined by the team's strategy. There are currently 3 strategies in the game:

- NORMAL
- KEEP POSSESSION
- COUNTER ATTACK

And I can add more in the future.

Each strategy results in entirely different ways of playing. And that is what I wanted to go for.

If you look at the stats in the end of the game, you will see what I'm saying: KEEP POSSESSION usually results in a high
amount of passes, while COUNTER ATTACKs usually have high amounts of crosses.

With all of that in mind, how does the simulation work with all of these elements?

Basically, we track the team that is currently in possession. We look at which events are most likely to happen given their
current strategy. Each strategy prioritizes certain events. Then when the event is chose, we calculate the outcomes.
We choose a player from the opposite team given their position on the field. If the ball is currently in a defensive position,
the game will likely choose an offensive player to try to oppose the action.

The player's attributes play a key role in determining the outcome. Passing, for example, takes into account how good a
player is with their passing-related attributes. That determines the first outcome, but each event can have a sequence of
outcomes that then determine what happens in the end.

For example:

If player A tries to pass the ball to player B, the game looks into player's A attributes to determine if the pass will miss
or succeed. If they succeed the pass, then it looks into player B's positioning attributes to determine if they are onside
or offside (if they are in an offensive position). However, if they miss the pass, it determines if the ball was intercepted
or just stolen by the opponent.

In more offensive positions, the game starts to prioritize shot events, which results in goal opportunities, and eventually
gives us goals.

Until I reached this point, I had to test a lot of different things. There's even more to do in the match simulation in
OFM, such as the substitutions, which is a key part of soccer that eSports do not incorporate, and even taking player's
stamina into account, which currently does not happen in the game.

I hope you liked this article about the Openfoot Manager simulation approach. We can improve it in the near future, but I at
least hope you got the idea behind this high-level overview.
