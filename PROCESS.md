# Process overview

## What I built

<!-- 这段是 agent 起草的、对成品的描述，不是我的个人陈述 —— 下面的三个时刻和
     reflections/assignment-1.md 才是。读一遍，不像自己说的话就改掉，然后把这
     条注释删了。 -->

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

<!-- Three or four. For each one, four jobs:
     1. what happened — the problem, or what the agent got wrong
     2. what you did instead of the obvious thing — the call, and why it beat it
     3. how you knew it was right — the check, the viewport, what you read
        before accepting the diff
     4. the citation — already filled in below

     Jobs 2 and 3 are where the marks are: the repo can't tell a reader those
     on its own. -->

### 1. Adding the camera, and replacing the flat colour block with a simulated print

At the time I felt the explanatory diagram was too simple and not clear enough.
There were also very few Polaroid-related elements on the page — the photo
didn't even show a picture, just a flat colour block, which was too far from
real imaging. The obvious thing to do was to add some Polaroid elements, like
the colour stripes and the film border. But what I wanted was a more detailed,
more realistic interaction, so I added a camera and simulated the print being
ejected, and the demo picture changed from a flat colour block to a simple but
more realistic image — an apple, a green leaf.

I did do the obvious thing, but found it wasn't enough. In the browser I tried
the demo with different pictures and judged whether it showed the principle I
was trying to show.

[`7427934...69e78d8`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-yue03084-ce/compare/7427934...69e78d8)

### 2. Turning the exploded view into light passing through the film

I developed the original "Tip the stack back" animation into light passing
through, which shows more intuitively how light passes through the film and
then forms the image.

Pulling the layers apart was actually a bit redundant. I was going to delete
it, but then thought I could add a demonstration at the level of the light
instead. I checked all of the subjects, and the effect matched the principle I
wanted to show.

[`9949e59`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-yue03084-ce/commit/9949e59)

### 3. Putting the rules into CLAUDE.md instead of into another prompt

Yes, I felt I was saying the same things over and over, and I wanted to write
them down so I wouldn't have to repeat them later. The obvious thing to do was
just to repeat them every time, but when there are many iterations, or other
tasks come in between, I might forget — and that could cause problems for the
whole project. So I thought putting them in the file was better. Later, when I
wrote prompts — for example when I changed and then removed the sound effects —
I wasn't repeating them any more.

<!-- 这段可以配一条 prompt 引用，因为这个时刻是你问出来的，不是我提的。想加
     就把下面这句放进来（它会渲染成引用块）：

     > 在过去的一些prompt里，有没有什么一些共同的约束或者其他东西可以作为
     > back pressure的 -->

[`bcccf70`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-yue03084-ce/commit/bcccf70)

<!-- 还没用上的候选，想换掉上面任何一个就从这里拿：

     - 探针在说谎：探针读了旧构建报「没变化」，改了本来就对的代码。两次。
       6470655 / cc02556
     - BEM 写进 stylelint 配置，而不是又发一条 prompt。7159b80
     - 390px 下两个色块都 display:none，手机访客只有图没有结果。
       8775b10...ab0ced7
     - 键盘能 tab 到每个控件，一个都驱动不了。57e44ac
     - 蛋糕暴露了 sliceSummary 的简单多数决 bug，蓝天也在撒谎。bd3a74a
     - 声音：做成了机械声（量过，技术上是成的），然后整个删掉。
       474146f...09143c9

     要把 prompt 和它produce的 commit 配对，就把 prompt 引在引用旁边（挑过的，
     不是整段 transcript）：

     > the prompt, verbatim

     截图也可以，如果一张图比一句话更能说明你验证了什么。把文件 commit 进来，
     用相对路径链接，GitHub 上就能渲染：![alt](docs/before.png) -->
