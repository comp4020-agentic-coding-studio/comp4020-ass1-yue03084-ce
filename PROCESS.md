# Process overview

## What I built

An interactive explainer for how a Polaroid print develops. A camera ejects the
print, and a slider runs time forward so you can watch the photo come up out of
the black. Beside it is a cross-section of the film, where each dye climbs from
its own layer to the receiving layer at the top. You can drag a marker across
the photo to pick which column the cross-section is of, switch between five
subjects, and tip the stack back to trace the light through it. The idea I
wanted to get across is the part that sounds backwards: the picture is painted
by the dye that had no work to do. A layer that was hit by light traps its own
dye, so the colour you end up seeing is the one that was free to climb.

## The moments that mattered

### 1. Adding the camera, and replacing the flat colour block with a simulated print

At the time I felt the explanatory diagram was too simple and not clear enough.
There were also very few Polaroid-related elements on the page — the photo
didn't even show a picture, just a flat colour block, which was too far from a
real print. The obvious thing to do was to add some Polaroid elements, like the
colour stripes and the film border. But what I wanted was a more detailed, more
realistic interaction, so I added a camera and simulated the print being
ejected, and the demo picture changed from a flat colour block to a simple but
more realistic image — an apple, a green leaf.

I did do the obvious thing, but found it wasn't enough. In the browser I tried
the demo with different pictures and judged whether it got across the principle
I was trying to show.

[`7427934...69e78d8`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-yue03084-ce/compare/7427934...69e78d8)

### 2. Adding the cake, the subject with the most colour in it

I added one more picture, a slice of cake. This one has more layers of colour in
it than the others, and it is the closest to how a real Polaroid photo develops.

The obvious thing to do was to leave it as it was, but I felt the pictures I
already had only highlighted the changes in the three main colours. I wanted a
picture with more layers in it to show the principle behind how the image forms.

I dragged the slice marker up and down and checked whether the colour of each
layer matched the result it showed.

[`bd3a74a...795e697`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-yue03084-ce/compare/bd3a74a...795e697)

### 3. Turning the exploded view into light passing through the film

I developed the original "Tip the stack back" animation into one where light
passes through the stack, which shows more intuitively how the light travels
through the film and forms the image.

Pulling the layers apart was actually a bit redundant. I was going to delete it,
but then thought I could add a demonstration at the level of the light instead.
I checked all of the subjects, and the effect matched the principle I wanted to
show.

[`9949e59`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-yue03084-ce/commit/9949e59)

### 4. Putting the rules into CLAUDE.md instead of into another prompt

I felt I was saying the same things over and over, and I wanted to write them
down so I wouldn't have to repeat them later. The obvious thing to do was just
to repeat them every time, but when there are many iterations, or other tasks
come in between, I might forget — and that could cause problems for the whole
project. So I thought putting them in the file was better. Later, when I wrote
prompts — for example when I changed and then removed the sound effects — I
wasn't repeating them any more.

Before:

> Read the existing code first and work within its structure and style. These
> are INCREMENTAL improvements — do not restructure the page, do not rewrite
> the existing copy, and do not break any existing interaction.

After:

> Remove the camera sound effects entirely: delete the shutter click and motor
> whir audio code (the Web Audio API synthesis), the mute/unmute toggle, and
> any related state or settings. The shutter press and ejection animation stay
> exactly as they are, just silent.

[`bcccf70`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-yue03084-ce/commit/bcccf70)
— [`474146f...09143c9`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-yue03084-ce/compare/474146f...09143c9)
