[**TODO** Matt will write the Intro.]{style="color: Red"}

[**TODO** Mini map is not oriented with player?]{style="color: Teal"}

[**TODO** IEEE VR 2027 \[<https://ieeevr.org/2027/contribute/papers/>\]\
Abstract deadline: August 24th, 2026 (23:59 AoE)\
Paper submission deadline: August 31st, 2026 (23:59 AoE)\
Paper must be anonymized; up to 9 pages of content + up to 2 pages of
references\
]{style="color: Teal"}

Using virtual reality (VR) requires us to adjust how we move around the
space. Locomotion in VR remains an unsolved problem since the virtual
space requires arbitrarily large real space to simulate any environment
for the user to explore. However, many techniques sidestep the issue and
introduce alternative ways of transport, many of which would not be
possible in real space.

One of those techniques is teleportation, which is the focus of this
paper. The general method of teleportation consists of the user choosing
a location, often using a curved line that falls to the ground, and
confirming the selection with a button. [**TODO** There are nuances,
which we'll describe later.]{style="color: Teal"} The curved line
sometimes simulates the ballistic curve of a thrown object, which
creates a natural interaction for the user [**TODO** find a source for
this claim]{style="color: Teal"}.

The idea for this method came from the following question: "What if,
instead of curving the line, we curve the world?"

# Related Work

[**TODO** Michael will write RW]{style="color: Red"}

We base our work on the research of locomotion techniques and their
usage in VR applications. We focus on long-range locomotion, which
allows users to quickly traverse long distances. Since we transform the
space in the Tsunami technique, we also explore the rendering of
non-Euclidean virtual environments and their unique challenges.

## VR Locomotion

[@bozgeyikli2016point] The original paper for Point & Teleport
technique.

Minimaps with waypoints

Change the scale of the user

World in Miniature

[@stoakley1995virtual] The original paper for the World in Miniature
(WIM) metaphor.

[@englmeier2021spherical] World in Miniature Metaphor wrapping the plane
onto a sphere. They create a cool effect of a Tiny Planet that can be
rotated to navigate the minimap.

[@weissker2024try] A WIM metaphor where the user can change their scale
to experience the world differently. This can be considered as another
viable method of long-range teleportation. But we should not propose to
make an exhaustive list.

[@domenico2024evaluation] A short paper demonstrating the WIM. I think
we will have enough examples, so we don't need to cite this one.

Discuss motion sickness very briefly (idea is to limit ms with our
method)

## Space Transformation

Movies: Inception / Dr Strange

VR walking in circles (gym) -- different approach, but tangentially
related

Spherical world

non-linear ray casting of terrains [@falk2007panorama]

Hyperbolic world
<https://www.youtube.com/watch?v=pXWRYpdYc7Q&ab_channel=CodeParade>

## Bachelor's Theses

[**TODO** Use these bachelor's theses as a primary
source:]{style="color: Teal"}

- Timotej Džugas' BT, Project Tsunami 1st gen:
  <https://is.muni.cz/th/wp9ok/?lang=en>.

- Vít Levinský's BT, handheld miniature:
  <https://is.muni.cz/th/feq19/?lang=en>.

Other parts of the project:

- The 2D version of Tsunami, illustrating the principle:
  <https://editor.p5js.org/Insectslayer/sketches/AKePsRJ4kO>.\

- Unity project of the Tsunami implementation:
  <https://gitlab.fi.muni.cz/xlang2/project-tsunami>.

[@falk2007panorama] Transformation of the 3D terrain to mitigate
occlusion by mountains. They use non-linear raytracing, which I
considered when designing the technique. However, I decided against it
because it would require developing a new rendering engine, which I
don't feel competent to do, and more importantly, it would make it
harder for anyone else to use it in their application.

# Research Questions

[**TODO** Vítek will write the Research Questions]{style="color: Red"}

# Design

The Tsunami metaphor came from the following idea. *When teleporting in
VR, what if, instead of pointing with a curved line into the straight
world, we pointed with a straight line into a *curved world*?* This
reminds us of the iconic scene from the 2010 movie Inception, where the
cityscape folds in on itself, creating a mesmerizing view and revealing
parts of the cityscape previously unseen. The name Tsunami came from the
proverbial wall of water that the natural phenomenon may resemble. The
rising terrain may resemble a tsunami. [**TODO** Repeat this gold in the
intro.]{style="color: Teal"} To create a viable design metaphor for
long-range teleportation, we establish the following design
requirements.

1.  []{#req:long_distance label="req:long_distance"} **: Long Distance
    Teleportation** We design the method to extend the practical range
    of teleportation, enabling users to traverse vast distances
    efficiently. We want to implement teleportation in such a way that
    allows the user to reach those distant places using the traditional
    point-and-teleport technique.

2.  []{#req:open_areas label="req:open_areas"} **: Optimized for Open
    Spaces** The transformation of the terrain is best appreciated in an
    open space, such as a city or natural landscape, where the ability
    to cover large distances aligns with user expectations and use
    cases. Long-range teleportation in enclosed spaces has very limited
    use cases.

3.  []{#req:familiarity label="req:familiarity"} **: Familiarity &
    Simplicity** Our goal is to create a method that is easy and
    intuitive to use, while adhering to established teleportation
    concepts as much as possible. In practice, this means keeping the
    familiar point-and-teleport interaction, whether it uses a straight
    line or a parabolic arc. As Funk et al. discuss
    [@funk2019assessing], these techniques are widely used, so most VR
    users would already be familiar with them. We also want to avoid
    adding new buttons or interaction steps, since movement is one of
    the most frequently used tools, so we want to keep the experience as
    streamlined as possible. Finally, since our approach applies a
    spatial transformation to the entire world, we must preserve the
    user's immediate surroundings as much as possible. Sudden or drastic
    changes in nearby terrain could increase the risk of motion
    sickness.

4.  []{#req:inclusivity label="req:inclusivity"} **: Inclusivity** We
    want the new method to be accessible to all users, regardless of
    experience. This is largely achieved by fulfilling
    [\[req:familiarity\]](#req:familiarity){reference-type="ref"
    reference="req:familiarity"}, but there are further aspects. For
    example, new users (especially those trying VR for the first time)
    can be easily overwhelmed and take longer to adjust. By making the
    transformation slower to accommodate the new user, we risk
    alienating experienced power users who want to use the method to
    quickly traverse long distances. We need to find a balance between
    those two groups and, ideally, design the method so that it allows a
    seamless transition between traditional teleportation and the new
    method. This may be seen as a method of progressive disclosure,
    which is an established interaction design pattern.

5.  []{#req:cool label="req:cool"} **: Engaging & Fun** Last but not
    least, we believe the method should invoke a sense of wonder and be
    fun to use to be adopted, so we consider it a vital design
    requirement. While it will certainly not fit every scenario, we want
    the developers to include it in their toolbelts for the special
    occasion when it does.

During the initial design, we considered multiple options for curving
the virtual world. The most straightforward solution is to transform the
terrain, either by altering the objects' geometry or via vertex shaders.
This is also the solution we implemented at the end. Another solution
considers a similar approach to Falk et al. [@falk2007panorama], who use
non-linear beams of light to distort the space. While this solution
provides significant flexibility in transforming space, it is also
computationally expensive and requires a fully customized rendering
engine.

# Tsunami Transformation

The basic concept of the transformation is to swap the curve of the
pointing line with the straight Euclidean space of the world. We chose a
parabola with a variable quadratic coefficient because it is a
well-understood function that satisfies our requirements, primarily to
keep the implementation simple, as per
[\[req:easy_implementation\]](#req:easy_implementation){reference-type="ref"
reference="req:easy_implementation"}. [**TODO** PaM, what are the
beneficial properties of parabolas that we can
mention?]{style="color: Teal"}

In the explanation, we will adhere to Unity's left-handed Y-Up
coordinate system. That way, the transition from 2D to 3D examples won't
require a change of notation. We also call the xy-plane the zero plane,
with the caveat that we are referring to the user's coordinate system.
That means the zero plane is always at the user's feet, regardless of
the world's elevation.

We also define the original space as the *flat world* and the
transformed space as the *curved world*.

## Reconstructing the Transformation

A naïve transformation of every point upwards from the zero plane
results in stretching that does not follow the concept of a *curved
world*([1](#fig:transform_straight_up){reference-type="ref+label"
reference="fig:transform_straight_up"}).

$$\begin{equation}
    \textbf{P}^\prime = \left( x \quad y + ax^2 \right)
\end{equation}$$

<figure id="fig:transform_straight_up" data-latex-placement="tbp">
<img src="./images/transform_straight_up.png" />
<figcaption>The simple transformation upwards creates a stretched
terrain.</figcaption>
</figure>

We expect the terrain to curl along the parabola, so we need to add a
rotation to the transformation. We introduce it by adding the parabola's
normal vector $\textbf{n}$ to every point.

$$\begin{equation}
    \textbf{n} = \left(\frac{-2ax}{\sqrt{4a^2x^2 + 1}} \quad \frac{1}{\sqrt{4a^2x^2 + 1}} \right)
\end{equation}$$

$$\begin{equation}
    \textbf{P}^\prime = \left(x - \frac{2ax}{\sqrt{4a^2x^2 + 1}} \quad ax^2 + \frac{y}{\sqrt{4a^2x^2 + 1}} \right)
\end{equation}$$

<figure id="fig:transform_up_and_tilt" data-latex-placement="tbp">
<img src="./images/transform_up_and_tilt.png" />
<figcaption>Applying a tilt along the normal for every point creates
better results at the base, but the farther features get
stretched.</figcaption>
</figure>

While it creates the desired effect of aligning to the parabola, the
transformation expands the terrain in width as it gets further from the
origin ([2](#fig:transform_up_and_tilt){reference-type="ref+label"
reference="fig:transform_up_and_tilt"}). If we move some distance along
the zero plane, we can see that the distance along the parabola is much
greater, creating the stretching artifact. This brings us to the final
improvement we need to apply. We need to compensate for the distance
traveled along the parabola compared to the zero plane.

## Arc Length of the Parabola

The arc length is the distance between two points along a curve. If a
curve in $\mathbb{R}^2$ is defined by the equation $y=f(x)$, which is
true for a parabola, the formula for computing arc length is as follows:

$$\begin{equation}
    L = \int^n_m \sqrt{1 + f^\prime(x)^2} \  dx,
\end{equation}$$

where $m,n$ are x-coordinates. The solution for the parabola is

$$\begin{equation}
    L(a, x') = \int^n_m \sqrt{1 + 4x'^2} \  dx = \frac{2ax' \sqrt{1 + 4a^2x'^2} + sinh^{-1}(2ax')}{4a},
\end{equation}$$ [**TODO** Double check the
notation.]{style="color: Teal"}

for the case where $m=0$ and $n=x'$. In other words, the distance
between the origin and the desired point along the parabola. The arc
length factor $L$ takes a position on a parabola given by an x
coordinate and returns a distance along the curve.

For the purposes of computing the Tsunami transformation, we need an
inverse function $L^{-1}$, which takes a distance along a parabola and
returns a corresponding position on it as an x coordinate.
Inconveniently, the inverse function does not have a closed-form
solution. The solution can, however, be obtained numerically, as
explained in [5](#sec:implementation){reference-type="ref+label"
reference="sec:implementation"}.

## Final Form

When we apply the $L^{-1}$ factor, we compensate for the stretching seen
in [2](#fig:transform_up_and_tilt){reference-type="ref+label"
reference="fig:transform_up_and_tilt"}. Each point is assigned
coordinates based on how far along the parabola it is, not on its
original x coordinate. The final transformation of a point
$\textbf{P}=(x,y)$ is as follows

$$\begin{equation}
    \begin{aligned}
            x' =\ & L^{-1}(a,x) - \frac{2aL^{-1}(a,x)}{\sqrt{4a^2L^{-1}(a,x)^2 + 1}},\\
            y' =\ & aL^{-1}(a,x)^2 + \frac{y}{\sqrt{4a^2L^{-1}(a,x)^2 + 1}} .
    \end{aligned}
\end{equation}$$

The final 2D transformation result is shown in
[6](#fig:zero_plane_position){reference-type="ref+label"
reference="fig:zero_plane_position"}. To extend the transformation into
3D (in Y-up coordinates), we simply calculate the distance from the
origin as Euclidean distance and treat it as the x coordinate. The y
coordinate is unchanged.

<figure id="fig:zero_plane_position" data-latex-placement="tbp">
<figure id="fig:zero_plane_position_below">
<img src="./images/transformation_below_zero_plane.png" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:zero_plane_position_at">
<img src="./images/transformation_at_zero_plane.png" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:zero_plane_position_above">
<img src="./images/transformation_above_zero_plane.png" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figcaption></figcaption>
</figure>

<figure id="fig:transform_notation" data-latex-placement="tbp">

<figcaption>A visual description of the transformation with the notation
of the symbols used.</figcaption>
</figure>

## Inverse Transform {#subsec:inverse_transform}

For reasons explained in the
[5](#sec:implementation){reference-type="ref+label"
reference="sec:implementation"}, we need to define an inverse
transformation. First, we must find the normal to the parabola going
through $P'$: $$\begin{equation}
    2a^2 x_{Q'}^3 + (1 - 2a y_{P'}) x_{Q'} - x_{P'} = 0
\label{eq:line_through_parabola}
\end{equation}$$

The $x_{Q'}$ is the x coordinate of the intersection we're looking for.
The solution is one of the roots of a cubic equation. Fortunately, the
limited height described in
[4.5](#subsec:limitations){reference-type="ref+label"
reference="subsec:limitations"} works to our advantage in ensuring the
discriminant will always be negative. That limits the solution of the
cubic equation to a single real root, which can be computed using
Cardano's formula.

After finding the intersection $Q'$, we can compute the arc length $L$,
which gives us the x coordinate in the straight world. The y coordinate
is simply the distance $|PQ|$. The final inverse transformation to a
point $\textbf{P}=(x,y)$ is as follows

$$\begin{equation}
    \begin{aligned}
        x =\ & L(a, x_{Q'}),\\
        y =\ & sgn(y_{Q'} - y_{P'})\sqrt{(x_{Q'} - x_{P'})^2 + (y_{Q'} - y_{P'})^2}.
    \end{aligned}
\end{equation}$$

## Limitations {#subsec:limitations}

The transformation applied to the terrain poses some limitations on the
environments in which it can be used.

**Limited Height** There is an intrinsic limit on the height of the
terrain from the zero plane Terrain exceeding maximum height may go over
the vertical axis and clip into other objects, resulting in unwanted
visual artifacts. The height $h(x)$ depends on the curvature factor $a$
and the distance from the origin.

$$h(a, x) = \sqrt{L^{-1}(a,x)^2 + \frac{1}{4a^2}}.$$

The maximum height rises further from the origin, which would suggest
that the distant structures can be higher than the close ones. However,
since the origin of the curvature is always at the user's location, we
should assume the minimum of $h(x)$, which is $h(0)$. Then, the solution
is

$$h(0) = \frac{1}{2a}.$$

As shown in [6](#fig:zero_plane_position){reference-type="ref+label"
reference="fig:zero_plane_position"}, the position of the zero plane
changes the distortion of the environment. To preserve the local space,
the zero plane should always follow the user and stay at their feet.
Otherwise, we may expect shrinking and expansion artifacts presented in
[6](#fig:zero_plane_position){reference-type="ref+label"
reference="fig:zero_plane_position"}. The takeaway is that the maximum
height limits only the local height differences, such as very tall
buildings. Gradual changes in the terrain (mountain slopes) should pose
no major issue.

**Open Space** The transformation is effective only in open, expansive
spaces, such as cities or nature. Not only is the curving of the terrain
much less effective in closed areas, but the shrinking of the area right
above the user creates many unwanted visual artifacts. The curved space
reveals much of the surroundings to the user, which might be undesirable
in experiences built on gradual exploration of the map.

**Invisible Skybox** Curving of the space causes the terrain to cover
most of the space previously occupied by the sky in the *flat world*.
The rising boundary covering the skybox may break immersion and strain
the user's suspension of disbelief. To overcome this, we suggest
covering the horizon in a global fog, which blends with the skybox and
hides the terrain boundary. This may force a certain atmosphere to the
scene, which might be undesirable to the setting. We advise further
experimentation on an individual basis to find settings that are
suitable for a given scenario.

**Small Polygons** Lastly, the transformation of the world causes
previously straight lines to be curved. This results in potential
interpolation issues, where large polygons are distorted and displaced.
This affects only low-poly structures and can be mitigated by
subdividing large polygons. This may have an impact on the computation
demands and should be assessed per case by the developer.

# Implementation {#sec:implementation}

The project was implemented using Unity (version 6.3) alongside the XR
Interaction Toolkit. To test and compare the tsunami teleportation with
established approaches, two additional teleportation methods were used,
resulting in a total of three locomotion systems. All three
teleportation methods can be triggered using both hands So that users
can use their dominant hand.

Baseline

:   The baseline is already the default teleportation system provided by
    the XR interaction toolkit and is also the most common one. To be
    able to use this method in our case, we extended the baseline to a
    length of 250 meter to be able to reach distant targets/ positions
    in the world-map. [**TODO** is 250 meter
    right?]{style="color: Teal"}

Mini map

:   The mini-map uses gpu instancing to render the terrain objects and
    buildings to reduce draw calls. Using gpu instancing teleportation
    between the mini map and the main map (terrain) is simplified as
    both share the same spatial coordinate spaces. For teleportation,
    the controllers ray is transformed into world space with an inverse
    matrix transformation. This world-space ray cast immediately
    provides the target location, enabling seamless teleportation.

Tsunami

:   Apart from the transformation formulas, the Tsunami algorithm
    requires implementation details to be applicable. They include
    implementing the transformation in a shader, utilizing inverse
    transform to interact with the *curved world*, and using precomputed
    values to speed up the numeric methods. Teleport detection on the
    deformed terrain is done by using a two stage ray march algorithm.
    It first iterates through the ray using coarse segments. Once a
    collision interval is found, it is refined iteratively to return the
    exact position for the player's teleportation.

## Vertex Shader

Tsunami needs to be able to run in scenes containing millions of
vertexes, and it would be painfully slow to compute position of each
vertex every frame the terrain moves. Therefore, the forward
transformation from *flat world* to *curved world* is implemented in a
vertex shader. The transformation is run in parallel for many vertexes
at a time, resulting in manageable fps.

The visuals project to the *curved world*, while all colliders and the
game physics stay in the *flat world*. This is beneficial since it's
decoupled from the rest of game logic. However, any interaction with the
*curved world*, which includes selecting a teleportation target, needs
to be recomputed back into the *flat world*. The teleportation ray is
shot in the *curved world*, so to define how it behaves in the *flat
world*, the inverse transform is used, as described in
[4.4](#subsec:inverse_transform){reference-type="ref+label"
reference="subsec:inverse_transform"}.

## Arc Length Function Cashing

The Tsunami transformation utilizes an arc length function, which is a
nonlinear function, that doesn't have a closed-form solution for its
inverse. In our application, we implement a bisection method to find the
solution numerically. This is however slow and inconvenient method of
computation in a GPU, where the inverse is used.

The arc length function is dependent on the curvature parameter $a$ and
the distance $x$. Both have defined ranges which are known at the
startup so we can precompute the values beforehand and use only a quick
access lookup table (LUT) during rendering. When building the LUT, we
need to compute every combination of the curvature $a$ and the distance
$x$. Since we animate the rising of the terrain, we need to sample the
curvature along the whole range. The range of $x$ is defined from zero
to the maximum rendering distance.

We store the computed values of the LUT in a 16-bit float texture which
is loaded into GPU. The added benefit of using the texture is that we
can utilize the GPU's built-in functionality of linear interpolation to
approximate values falling in between the sampled points.

The optimizations result in a rendering method that can be applied to
reasonably large scenes without a major performance hit.

## Prototype for User Study

[**TODO** Zsanet]{style="color: Red"} [**TODO** Zsanet will write the
design of the demo application]{style="color: Red"}

# User Study

We conducted a controlled, within-subject laboratory study comparing
three VR locomotion techniques: conventional short-range *Baseline*
teleportation, *Minimap*-assisted teleportation, and *Tsunami*. Minimap
and Tsunami represented two contrasting strategies for extending
teleportation to mid- and long-range navigation. The minimap implements
a user-controlled allocentric design, where the map initializes in a
stable north-up position and acts as an external reference frame---even
when manually rotated---while the user's position marker rotates
dynamically to reflect their real orientation. Tsunami instead provides
an egocentric, spatially continuous traversal technique.

We organized the study around three research questions:

- *RQ1 (Practical Viability):* How do different strategies for extending
  teleport locomotion support efficient long-range VR navigation?

- *RQ2 (Spatial Awareness):* Does preserving first-person spatial
  continuity during teleportation improve users' directional awareness
  and environmental continuity perception compared with minimap-assisted
  long-range teleportation?

- *RQ3 (Usability Trade-Offs):* What usability and comfort trade-offs
  emerge between continuity-preserving and minimap-assisted long-range
  teleportation techniques?

We formulated five directional hypotheses:

H1.1

:   Tsunami and Minimap-assisted teleportation will reduce
    route-completion times compared with Baseline teleportation during
    long-range VR navigation tasks.

H2.1

:   Tsunami will reduce post-teleport reorientation effort compared with
    Minimap-assisted teleportation.

H2.2

:   Participants will report higher spatial-awareness ratings with
    Tsunami than with Minimap-assisted teleportation.

H3.1

:   Baseline teleportation will produce lower cybersickness symptom
    severity than Tsunami and Minimap-assisted teleportation.

H3.2

:   Participants will report lower perceived workload with Tsunami than
    with Minimap-assisted teleportation.

The study used a repeated-measures design in which every participant
experienced all three locomotion conditions. Locomotion method was the
primary independent variable. Target distance, route, task progression,
method order, and study site were incorporated where appropriate in the
task design or statistical models. Participant was modeled as a random
factor in trial-, teleport-, and route-level mixed-effects models.

The evaluation comprised two complementary phases. The *Precision Task*
examined target acquisition, landing accuracy, and interaction time at
controlled target distances. The *Navigation Task* evaluated route
traversal, interaction effort, spatial behavior, workload, and user
experience in a city environment.

The experiment was conducted at two sites affiliated with the author
team. The sites are referred to as [Site A]{.smallcaps} and [Site
B]{.smallcaps} during double-blind review. Both provided comparable
enclosed indoor testing conditions. Participants completed the VR tasks
individually in an approximately $5 \times 5$ m area while standing and
were permitted to move physically within the available space.

We used a Meta Quest 3 headset with Meta Quest Touch Plus controllers.
The experimental application was implemented in Unity 6000.3.20f1 and
ran directly on the headset using the headset's default system refresh
rate. Audio was not an experimental manipulation; a short auditory cue
merely confirmed that a checkpoint had been reached.

## Participants

We recruited [42 participants]{style="color: orange"} (24 from Site A,
18 from Site B). Participants were recruited through convenience
sampling within the researchers' broader social and professional
networks, followed by snowball recruitment. They received no financial
compensation. Eligibility was restricted to adults aged 18--45 years
with normal or corrected-to-normal vision and without a self-reported
vestibular disorder or strong susceptibility to VR sickness. [N
participants were aged 18--24 years, N were aged 25--34 years, and N
were aged 35--45 years. N participants identified as female, and N as
male. N participants were right-handed and N were left-handed. N
participants reported no previous experience with teleport-based VR
locomotion, N had tried it once or twice, N had used it occasionally
across multiple sessions, and N reported frequent
use.]{style="color: orange"}

The mean Santa Barbara Sense of Direction (SBSOD) [@hegarty2002sbsod]
score was [$4.87$ ($SD=0.88$, median $=5.00$, range
$=3.07$--$6.13$)]{style="color: orange"}, where a higher score indicates
a better self-reported sense of direction. We use SBSOD descriptively to
characterize the sample and do not treat it as a confirmatory moderator.

#### Ethics

Under the applicable national legal regulations and institutional
requirements, the study did not require review by a Research Ethics
Committee. The responsible institutional Research Ethics Committee
provided a written statement confirming that. All participants provided
written informed consent before taking part.

## Procedure

Sessions lasted approximately 45--60 minutes. An experimenter was
present throughout and followed a prepared script to provide
standardized instructions. After providing informed consent,
participants completed the demographic questionnaire, SBSOD, and
baseline CSQ-VR measurement.

Participants then completed three method blocks according to their
assigned counterbalanced order. Each block followed the same sequence:

::: enumerate*
tutorial;

Precision Task;

Navigation Task; and

post-block questionnaires (outside VR).
:::

Tutorial was participant-controlled rather than governed by some success
criterion and they could remain there until they felt comfortable with
the technique. In practice, they spent there around three minutes.
Questionnaires were completed at a computer after each method block.
This period also provided a seated break from VR exposure before the
next locomotion method. At the end of the session, participants ranked
the techniques and completed an audio-recorded interview.

#### Counterbalancing

We counterbalanced the six possible method orders using an
18-participant rotation pattern. The same pattern was applied at both
sites. Route assignment was rotated jointly with method order so that
Routes A, B, and C occurred in different ordinal positions across
participants and conditions. The design specified three routes under
each of the three methods, corresponding to nine route observations per
participant. Method order, route, and study site were retained in the
relevant statistical models to account for procedural and environmental
variation.

#### Study Tasks

The user study focused on two main tasks. In *Precision Task*, the
participants completed nine sequential teleportation trials with each
locomotion technique: three trials at 50 m, three at 100 m, and three at
200 m. The task assessed target-relative landing error, task-completion
time, and controller hold/aiming time. Landing error was calculated in
the horizontal plane from the participant's final landing position
relative to the target center. In *Navigation Task*, the participants
navigated three predefined routes in a city environment under each
locomotion method. Each route consisted of seven checkpoints. Reaching a
checkpoint invoked a progress banner in the participant's field of view;
the participant had to confirm the banner before the next checkpoint
became visible. We separately retained net traversal time
([NetPathTime]{.smallcaps}) and total time including
checkpoint-confirmation delays ([TotalPathTime]{.smallcaps}). The
navigation logs recorded participant and controller positions, headset
and controller forward vectors, teleport events, active-checkpoint
positions, arrivals, and progress-banner confirmations. These records
supported analyses of route time, teleport count, path efficiency,
landing accuracy, and post-teleport behavior.

#### Questionnaires and Subjective Measures

The CSQ-VR [@Kourtesis2023csqvr] was administered before VR exposure and
after every method block. For each method, cybersickness change was
calculated as the post-block total minus the measurement immediately
preceding that block, respecting the counterbalanced method order. We
assessed perceived workload using the unweighted Raw NASA-TLX
(RAW-TLX) [@hart1988ntlx; @byers1989rtlx]. Responses were collected on a
0--20 scale and rescaled to 0--100 before analysis. After each method,
participants rated eight custom statements on a six-point agreement
scale (1 = strongly disagree, 6 = strongly agree). The spatial-awareness
composite used for H2.2 averaged position awareness, direction
awareness, and reverse-scored reorientation effort. Environmental
continuity was analyzed separately. Two distance-estimation items formed
the distance-awareness composite, and ease of learning and intuitiveness
formed the usability composite.

After all method blocks, participants ranked Baseline, Minimap, and
Tsunami for overall long-range-navigation preference, comfort,
intuitiveness, and fun. The complete questionnaire wording, scoring
rules, and composite reliability analyses are provided in the
supplementary materials. Interviews were audio-recorded and transcribed
for qualitative analysis. The resulting themes and illustrative
participant accounts will be used to complement and contextualize the
questionnaire findings, particularly the reported differences in spatial
awareness, workload, usability, and technique preference.

#### Qualitative feedback

The post-session interview addressed spatial continuity, awareness of
the surrounding environment, perceived dizziness, and visual distortion.
The interviews were recorded and transcribed. [**TODO** Conduct and
report a qualitative analysis of the interview
transcripts]{style="color: Teal"} [**TODO** Insert the final interview
guide and qualitative analysis procedure]{style="color: Teal"}

# Analysis and Results {#sec:analysis-results}

## Analysis Strategy

We organized the analyses according to the three research questions and
their associated hypotheses. Confirmatory analyses were distinguished
from supplementary, exploratory, and descriptive analyses. The
significance level was set to $\alpha=.05$. Holm correction was applied
within families of planned contrasts. In addition to statistical
significance, we report raw-unit differences, 95% confidence intervals
(CIs), and standardized or rank-based effect sizes to evaluate practical
significance.

Participant-level comparisons were based on paired observations and
evaluated using Wilcoxon signed-rank tests. The tests used
`zero_method = wilcox`, no continuity correction, and automatic exact or
asymptotic calculation. One-sided tests were used only for hypotheses
specifying an a priori direction; otherwise, two-sided tests were used.
Matched-pairs rank-biserial correlations and, where useful for
comparison with prior work, Cohen's $d_z$ accompany the tests. Paired
$t$-tests were retained only as sensitivity analyses and did not
determine the primary conclusions.

Mixed-effects analyses retained all available trial-, teleport-, or
route-level observations. Continuous positively skewed outcomes were
log- or $\log(1+x)$-transformed. The models included
participant-specific random intercepts and fixed effects for the
relevant task factors, method order, and study site. Exponentiated
coefficients are reported as adjusted ratios. Values below one indicate
a reduction relative to the reference condition.

Before analyzing the Precision Task, trials reflecting a demonstrably
failed interaction rather than completed target acquisition were
excluded according to a reproducible log-based decision procedure
established before the inferential analysis. Candidate cases were
evaluated using landing error, within-distance repetition consistency,
the recorded aim-to-teleport interval, and verification against the
source event log. The cleaned dataset was used for the primary precision
analyses; analyses retaining all trials were maintained as sensitivity
analyses. The complete decision rules and trial-level exclusion table
are provided in the supplementary materials.

The analysis included [$N=42$ participants]{style="color: orange"}. The
City Race dataset contained [341 of 342 expected
participant--method--route observations]{style="color: orange"}. One
participant was missing one Tsunami route. Mixed-effects analyses
retained all [341 available route observations]{style="color: orange"},
whereas participant-level analyses aggregating across routes required
complete route coverage for the corresponding participant and method.
Consequently, paired analyses involving that Tsunami summary contained
[37 eligible pairs]{style="color: orange"}; unaffected comparisons
contained [38 pairs]{style="color: orange"}.

## RQ1: Practical Viability

RQ1 examined whether the two long-range extensions of teleportation
supported more efficient navigation than conventional Baseline
teleportation.

### H1.1: Route Completion Time

H1.1 predicted that both Tsunami and Minimap-assisted teleportation
would reduce route-completion time compared with Baseline teleportation.
The primary outcome was net route-completion time, excluding
checkpoint-banner confirmation delays. Route times were first averaged
within participant and method after requiring complete coverage of
Routes A, B, and C for the corresponding outcome. Mean net completion
time was [$66.66$ s for Baseline, $48.98$ s for Tsunami, and $41.21$ s
for Minimap]{style="color: orange"}. Compared with Baseline, Tsunami
reduced completion time by [$18.07$ s, 95% CI $[-24.21,-11.92]$,
$d_z=-0.98$, Holm-adjusted $p<.001$]{style="color: orange"}. Minimap
reduced completion time by [$25.45$ s, 95% CI $[-31.43,-19.48]$,
$d_z=-1.40$, Holm-adjusted $p<.001$]{style="color: orange"}. These
effects were [statistically significant and large in practical
magnitude]{style="color: orange"}. H1.1 was therefore [supported for
both long-range techniques]{style="color: orange"}.

An exploratory direct comparison showed that [Minimap was faster than
Tsunami in net traversal time]{style="color: orange"}. The mean
Tsunami--Minimap difference was [$7.58$ s, 95% CI $[3.64,11.52]$,
$d_z=0.64$, $p<.001$]{style="color: orange"}. Thus, in the current
sample, both techniques substantially outperformed Baseline, but Minimap
provided the shortest active-navigation time.

#### Total time including checkpoint interaction.

We repeated the analysis using total route time, which included the time
spent viewing and confirming progress banners. Mean total time was
[$79.11$ s for Baseline, $62.57$ s for Tsunami, and $61.30$ s for
Minimap]{style="color: orange"}. Relative to Baseline, total time was
lower by [$16.98$ s for Tsunami, 95% CI $[-23.75,-10.22]$, $d_z=-0.84$,
Holm-adjusted $p<.001$]{style="color: orange"}, and by [$17.81$ s for
Minimap, 95% CI $[-24.43,-11.20]$, $d_z=-0.89$, Holm-adjusted
$p<.001$]{style="color: orange"}. In contrast to net time, total time
[did not differ between Tsunami and Minimap]{style="color: orange"}:
mean difference [$=1.07$ s, 95% CI $[-3.12,5.26]$, $d_z=0.09$,
$p=.777$]{style="color: orange"}. Minimap participants spent more time
at checkpoint banners, which offset its advantage in active traversal
time. From an end-to-end perspective, the two long-range techniques
therefore produced [comparable total completion
times]{style="color: orange"}.

#### Route-level robustness analysis.

Supplementary linear mixed-effects models retained all available
participant--method--route observations and controlled for route, method
order, and study site. Both long-range methods [remained faster than
Baseline for net and total time; all Holm-adjusted
$p<.001$]{style="color: orange"}. The adjusted total-time ratios
relative to Baseline were [$0.80$ for Tsunami, 95% CI $[0.75,0.84]$, and
$0.78$ for Minimap, 95% CI $[0.74,0.83]$]{style="color: orange"}. The
method-by-route interaction was [significant for net time,
likelihood-ratio $\chi^2(4)=26.90$, $p<.001$, and total time,
$\chi^2(4)=22.38$, $p<.001$]{style="color: orange"}. The magnitude of
the method advantage therefore varied across environmental layouts.
Nevertheless, the route-level models [agreed with the participant-level
conclusion of H1.1]{style="color: orange"}.

#### Interaction effort and path efficiency.

Exploratory analyses provided additional context for practical
viability. Path efficiency was calculated as ideal route length divided
by traversed distance. Participants performed an average of [$40.48$
teleportations with Baseline, $14.55$ with Tsunami, and $7.65$ with
Minimap]{style="color: orange"}. A negative-binomial repeated-measures
model indicated [substantially fewer teleportation events for both
Minimap and Tsunami than for Baseline; both Holm-adjusted
$p<.001$]{style="color: orange"}. Mean path efficiency was [$0.830$ for
Baseline, $0.858$ for Minimap, and $0.798$ for
Tsunami]{style="color: orange"}. Minimap produced [slightly higher path
efficiency than Baseline, adjusted ratio $=1.03$, 95% CI
$[1.01,1.05]$]{style="color: orange"}, whereas Tsunami produced
[slightly lower path efficiency, adjusted ratio $=0.96$, 95% CI
$[0.94,0.98]$]{style="color: orange"}. Thus, Tsunami improved completion
time and reduced interaction effort despite producing somewhat less
spatially economical trajectories in the current sample.

#### Exploratory Landing Accuracy in the Navigation Task.

We additionally examined long-range teleportations that landed directly
on a checkpoint. Events were divided into balanced distance bands of
200--350 m and 350--500 m. These analyses are conditional on successful
direct checkpoint-reaching teleportations and should not be interpreted
as estimates of the probability of reaching a checkpoint directly. For
200--350 m teleportations, adjusted landing error was [$2.41$ m for
Tsunami and $2.29$ m for Minimap]{style="color: orange"}. The adjusted
difference was [$0.12$ m, 95% CI $[-0.53,0.77]$, Holm-adjusted
$p=.723$]{style="color: orange"}. For 350--500 m teleportations,
adjusted landing error was [$4.02$ m for Tsunami and $3.39$ m for
Minimap]{style="color: orange"}. The difference of
[$0.63$ m]{style="color: orange"} was [not significant after
multiplicity correction]{style="color: orange"}, 95% CI
[$[0.03,1.23]$]{style="color: orange"}, raw
[$p=.029$]{style="color: orange"}, Holm-adjusted
[$p=.058$]{style="color: orange"}. A continuous-distance sensitivity
analysis found [no evidence that the relative difference changed with
distance, $p=.966$]{style="color: orange"}.

A complementary analysis included long-range arrivals followed by one or
more short corrections. In this analysis, the first Tsunami landing was
[farther from the checkpoint than the first Minimap
landing]{style="color: orange"}. Adjusted errors were [$7.83$ versus
$3.03$ m in the 200--350 m band and $15.34$ versus $3.27$ m in the
350--500 m band; both Holm-adjusted $p<.001$]{style="color: orange"}.
This result characterizes interaction strategy rather than final
target-acquisition accuracy: Tsunami was more frequently used as a
sequential approach followed by corrective teleportation.

## RQ2: Spatial Awareness

Through the RQ2 we investigated whether the first-person spatial
continuity provided by Tsunami improves objective reorientation behavior
and subjective spatial awareness compared with Minimap.

### H2.1: Post-Teleport Reorientation Effort

H2.1 predicted lower post-teleport reorientation effort with Tsunami
than with Minimap. We used separate $\log(1+x)$ mixed-effects models to
evaluate the temporal and angular components while controlling for
environmental target, method order, and study site and including a
participant random intercept. Holm correction covered the two-component
family.

Post-teleport reorientation effort was operationalized using two
components measured over the same method-neutral interval between
checkpoint arrival (`appear`) and progress-banner confirmation
(`progress_banner`). The primary temporal component, reorientation
latency, was the timestamp difference between these events. The
supporting angular component was the three-dimensional angle between the
headset-forward vectors recorded at arrival and banner confirmation.
Only direct checkpoint-reaching event sequences were eligible:
`teleport_map `$\rightarrow$` appear `$\rightarrow$` progress_banner`
for Minimap and
`teleport_tsunami `$\rightarrow$` appear `$\rightarrow$` progress_banner`
for Tsunami. Baseline finishing jumps within Minimap navigation were
excluded. These measures capture behavioral adjustment before checkpoint
confirmation and are not interpreted as direct evidence that a
participant knew the direction of the subsequent checkpoint.

The adjusted temporal estimate was [$2.15$ s for Tsunami and $2.98$ s
for Minimap]{style="color: orange"}. Tsunami reduced the interval by
[$0.83$ s, 95% CI $[-0.98,-0.68]$]{style="color: orange"}. On the
transformed scale, the adjusted Tsunami-to-Minimap ratio was [$0.79$,
95% CI $[0.77,0.82]$, Holm-adjusted $p<.001$]{style="color: orange"}.
The supporting angular analysis produced an adjusted estimate of
[$3.55^\circ$ for Tsunami and $20.85^\circ$ for
Minimap]{style="color: orange"}. The adjusted difference was
[$-17.30^\circ$, 95% CI $[-21.54,-13.06]$]{style="color: orange"}, with
a ratio of [$0.21$, 95% CI $[0.19,0.23]$, Holm-adjusted
$p<.001$]{style="color: orange"}.

Both components therefore indicated [substantially lower post-teleport
behavioral adjustment with Tsunami]{style="color: orange"} which
[supports]{style="color: orange"} H2.1.

### H2.2: Subjective Spatial Awareness

H2.2 predicted higher subjective spatial-awareness ratings for Tsunami
than for Minimap. The participant-level composite averaged the three
predefined spatial-awareness items and was evaluated using a one-sided
Wilcoxon signed-rank test. The mean composite score was [$4.55$ on the
six-point scale for Tsunami and $2.94$ for
Minimap]{style="color: orange"}. The mean paired difference was [$1.61$
points, 95% CI $[1.15,2.07]$, $d_z=1.15$, rank-biserial correlation
$=.89$, $p<.001$]{style="color: orange"}. This represents [a large and
practically substantial effect]{style="color: orange"}. H2.2 was
therefore [supported]{style="color: orange"}.

The subjective result [converged with the objective H2.1
measures]{style="color: orange"}: participants reported better spatial
awareness with Tsunami and also required less time and less
head-direction change before confirming checkpoint arrival.

#### Exploratory temporal development.

We explored whether post-banner behavior changed as participants
progressed through the navigation task. The time between banner
confirmation and the next aiming event [decreased over time for both
methods]{style="color: orange"}. This decline was [stronger for Minimap
than for Tsunami, as indicated by a method-by-progress interaction,
$p=.036$]{style="color: orange"}. Head rotation between banner
confirmation and subsequent aiming also decreased, but its
method-by-progress interaction was [not significant,
$p=.451$]{style="color: orange"}.

The latency result is compatible with our observation that most
participants increasingly relied on the minimap and reduced inspection
of the surrounding environment. Because this analysis was exploratory
and the behavioral metric cannot uniquely identify attentional strategy,
it should be interpreted as motivation for the qualitative analysis
rather than as confirmatory evidence of environmental disengagement.

## RQ3: Usability Trade-Offs

RQ3 examined perceived workload, cybersickness, and user preferences
associated with the three locomotion strategies.

### H3.1: Cybersickness

Mean total CSQ-VR score increased from [$7.00$ before VR exposure to
$7.82$ after the first block, $7.95$ after the second block, and $7.95$
after the third block]{style="color: orange"}. The scores showed [a
small initial increase followed by
stabilization]{style="color: orange"}. H3.1 predicted a smaller increase
in cybersickness symptoms for Baseline than for Tsunami and Minimap. For
each condition, we calculated the CSQ-VR change as the *post-condition -
pre-condition* CSQ-VR scores and analyzed them using two-sided Wilcoxon
signed-rank tests with Holm correction. The mean CSQ-VR change was
[$0.39$ points for Baseline, $0.29$ for Tsunami, and $0.26$ for
Minimap]{style="color: orange"}. Baseline did [not produce a smaller
symptom increase than Tsunami]{style="color: orange"}: mean
Baseline--Tsunami difference [$=0.11$, 95% CI $[-0.91,1.12]$,
Holm-adjusted $p=.812$]{style="color: orange"}. The Baseline--Minimap
difference was similarly [small and non-significant: $0.13$, 95% CI
$[-0.87,1.14]$, Holm-adjusted $p=.812$]{style="color: orange"}. Since
the data did not indicate indicate method-specific differences in
cybersickness change, H3.1 was [not supported]{style="color: orange"}.

### H3.2: Perceived Workload

H3.2 predicted lower perceived workload for Tsunami than for
Minimap-assisted teleportation. Mean RAW-TLX score was [$17.17$ for
Tsunami and $21.27$ for Minimap]{style="color: orange"}. A one-sided
Wilcoxon signed-rank test showed the mean paired difference [$-4.10$
points on the 0--100 scale, 95% CI $[-7.65,-0.55]$, $d_z=-0.38$,
rank-biserial correlation $=-.39$, one-sided
$p=.018$]{style="color: orange"}. The current estimate indicates [a
small-to-moderate practical reduction in perceived workload with
Tsunami]{style="color: orange"}, although the confidence interval
includes effects ranging from small to more noticeable. H3.2 was
therefore [supported]{style="color: orange"}.

### Technique Preferences

Post-study rankings provided descriptive and exploratory context for
RQ3. Tsunami was ranked first for overall long-range-navigation
preference by [23 of 38 participants]{style="color: orange"}, compared
with [10 for Minimap and five for Baseline]{style="color: orange"}. It
was also most frequently ranked first for [comfort (18 participants) and
fun (24 participants)]{style="color: orange"}. Baseline and Tsunami
received similar first-place counts for [intuitiveness (18 and 17,
respectively)]{style="color: orange"}, whereas Minimap was selected by
[three participants]{style="color: orange"}.

The omnibus difference in overall preference was [significant, Friedman
$\chi^2(2)=14.37$, $p<.001$, Kendall's $W=.19$]{style="color: orange"}.
Holm-adjusted pairwise comparisons showed that [Tsunami was preferred
over both Baseline and Minimap, whereas Baseline and Minimap did not
differ]{style="color: orange"}. These ordinal preference results
complement the workload findings but remain separate from the
confirmatory hypotheses. They will be interpreted together with the
qualitative interview analysis.

## Summary of Hypothesis Tests

[All hypotheses but H3.1 were supported]{style="color: orange"}. Both
long-range techniques [substantially reduced navigation time relative to
Baseline]{style="color: orange"}. Tsunami produced [lower post-teleport
behavioral adjustment and substantially higher subjective spatial
awareness than Minimap]{style="color: orange"}, while also yielding
[moderately lower perceived workload]{style="color: orange"}. The data
provided [no evidence of method-specific differences in cybersickness
change]{style="color: orange"}.

# Discussion & Limitations

[**TODO** Vítek and Matt will write the Discussion &
Limitations]{style="color: Red"}

# Conclusion & Future Work

[**TODO** Matt will write the Future Work]{style="color: Red"}

# Appendices {#sec:appendices_inst}

This section presents the tsunami transformation methods in greater
detail. It intentionally includes more material than may ultimately be
needed; we can decide later which parts to retain.

The central idea of the tsunami transformation is to uplift distant
regions of a scene, thereby increasing their visibility to the observer.
We first introduce the transformation for lines and planes and then
extend the concept to a three-dimensional world.

Consider the ground represented by the $xy$-plane and an observer
located at $Q=(0,0,\ensuremath{h})$, that is, $\ensuremath{h}$ units
above the origin. The observer's viewing direction in the vertical plane
is described by the angle $\ensuremath{\alpha}\in [0^\circ,180^\circ]$,
where $\ensuremath{\alpha}=0^\circ$ corresponds to looking down towards
the origin $O=(0,0,0)$ and $\ensuremath{\alpha}=180^\circ$ corresponds
to looking straight up. Although the observer may have an arbitrary
azimuth ($\ensuremath{\phi}\in [0^\circ,360^\circ)$), we set
($\ensuremath{\phi}=0^\circ$), corresponding to the positive $x$-axis,
without loss of generality.

To illustrate the proposed transformations, we use a simple pinhole
camera model. The image plane is located at focal distance $f$, and the
display consists of $(2\ensuremath{N}+1)\times(2\ensuremath{M}+1)$
pixels, each of size $\ensuremath{d_p}\times\ensuremath{d_p}$. The image
coordinate system is centered at the middle pixel, whose coordinates are
$(0,0)$. We use $(i,j)$ to denote discrete pixel coordinates and $(u,v)$
to denote continuous coordinates in the image plane. The corresponding
continuous coordinates of pixel $(i,j)$ are therefore
$(u,v)=(i\ensuremath{d_p},j\ensuremath{d_p})$. From the observer's point
of view, the positive $u$-axis points to the right and the positive
$v$-axis points upward.

We assume the observer views a flat disc world of radius
$\ensuremath{d_{w}}$, covered by a chessboard pattern with tiles of size
$\ensuremath{d_T}$. This choice allows us to present the effects of the
transformations visually. The geometric configuration and the notation
used throughout the paper are summarized in
Figure [11](#fig:notation){reference-type="ref"
reference="fig:notation"} and
Table [1](#tab:parameters){reference-type="ref"
reference="tab:parameters"}. The chosen parameters yield a vertical
field of view of $130^\circ$ and a horizontal field of view of
approximately $141^\circ$.

::: {#tab:parameters}
   [Parameter]{.smallcaps}  [Description]{.smallcaps}    [Default value]{.smallcaps}   
  ------------------------- ---------------------------- ----------------------------- --
           $d_{w}$          world radius                 500 m                         
            $d_T$           tile size                    30 m                          
             $h$            observer elevation           100 m                         
           $\phi$           observer azimuth             0°                            
          $\alpha$          observer viewing direction   65°                           
             $f$            focal distance               7 mm                          
            $d_p$           camera pixel size            0.05 mm                       
             $N$            half of display width        400                           
             $M$            half of display height       300                           

  : Basic parameters used in the figures.
:::

<figure id="fig:notation" data-latex-placement="tbp">
<figure id="fig:side_view_notation">
<embed src="./images/side_view.pdf" />
<figcaption>A side view of the world.</figcaption>
</figure>
<figure id="fig:top_view_notation">
<embed src="./images/top_view.pdf" />
<figcaption>Top-down view of the plane with a square grid.</figcaption>
</figure>
<figure id="fig:display_notation">
<embed src="./images/camera_view.pdf" />
<figcaption>Camera view.</figcaption>
</figure>
<figcaption>Camera view.</figcaption>
</figure>

The observer's viewing direction $\ensuremath{\alpha}$ may span the
interval $[0^\circ,180^\circ]$ within the vertical viewing plane, which
we identify with the $xz$-plane. For a flat world, however, only half of
this interval corresponds to visible ground, with the horizon occurring
at $\ensuremath{\alpha}=90^\circ$. The purpose of uplifting the ground
is to extend the angular range over which it remains visible. We denote
by $P$ the point seen by the observer on the original ground and by $P'$
its corresponding point on the uplifted ground.

The positions of these points in the vertical viewing plane can be
described using several coordinate systems. A natural choice is the
Cartesian pair $(x,z)$, where $x$ is the distance of the point's
orthogonal projection onto the original ground plane from the origin,
and $z$ is the point's elevation. For a point $P$ on the original
ground, $z=0$ and $x$ is equal to its distance $s$ from the origin.
Thus, the scalar $s$ provides a simpler one-dimensional parametrization
of the flat ground.

Similarly, once the uplifted profile is known, the position of the
corresponding point $P'$ can also be described by a single parameter
$s'$, interpreted as the **arc length** measured along the uplifted
curve from the origin. We require the tsunami transformation to preserve
the apparent ordering of points as seen by the observer. Consequently,
the position of a point can also be uniquely characterized by the
viewing angle $\ensuremath{\alpha}$ at which it is observed.

In the following, we introduce four methods for mapping a point $P$ on
the original ground to a corresponding point $P'$ on an uplifted
profile. We impose the following requirements: (1) the transformation is
smooth; (2) the arc length from the origin to $P'$ along the uplifted
profile remains equal to the original ground distance $s'=s$; and (3)
the apparent ordering of points, as seen by the observer, is preserved
($s_1>s_2\Rightarrow \alpha'(s_1)>\alpha'(s_2)$).

<figure id="fig:lifting_transformations" data-latex-placement="tbp">
<figure id="fig:lifting_parabolic">
<embed src="./images/lifting_parabolic_500.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_hyperbolic">
<embed src="./images/lifting_hyperbolic_500.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_angular">
<embed src="./images/lifting_angular_500.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_spherical">
<embed src="./images/lifting_spherical_500.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figcaption></figcaption>
</figure>

## One-dimensional tsunami transformations {#sec:1d_tsunami}

We represent the original flat ground by the curve
${\mathbf{g}(s)} = \{(s, 0):s\in[0, \ensuremath{d_{w}}]\}$. Our goal is
to construct a mapping
$T: [0, \ensuremath{d_{w}}]\rightarrow \ensuremath{\mathbb{R}}^2$ that
maps each point $P=(s,0)\in{\mathbf{g}(s)}$ to a corresponding point
$P'=T(s)$ on the uplifted profile. We denote the transformed ground by
${\mathbf{g'}(s)}$,
${\mathbf{g'}(s)}=\{T(s):s\in[0, \ensuremath{d_{w}}]\}$. Let $\alpha(s)$
denote the viewing angle of a point $P=(s,0)$ on the original ground.
With the angle measured from the downward vertical direction, we have
$\alpha(s)=\arctan({s}/{\ensuremath{h}})$. The viewing angle of the
world boundary is therefore
$\alpha_w = \arctan( {\ensuremath{d_{w}}}/{\ensuremath{h}})$.

Before the tsunami transformation, points in the modeled world are
visible over the angular interval $[0, \alpha_w]$. If the flat ground is
conceptually extended beyond the modeled world, points at distances
greater than $\ensuremath{d_{w}}$ occupy the interval
$[\alpha_w,90^\circ)$, while viewing angles in $(90^\circ,180^\circ]$
point above the horizon ($\alpha = 90^\circ$) and therefore the viewing
ray do not intersect the flat ground.

We denote by $\alpha'(s)$ the viewing angle of the transformed point
$P'=T(s)$. Requirement (3) implies that $\alpha'(s)$ must be a strictly
increasing function of $s$, so that the apparent ordering of points is
preserved. As the ground is uplifted while its arc length is maintained,
the transformed world boundary is generally seen at a larger angle
$\alpha'_w=\alpha'(\ensuremath{d_{w}})>\alpha_w$. The tsunami
transformation, therefore, spreads the modeled world over a larger
angular interval and increases its angular resolution from the
observer's perspective.

We use the desired value of $\alpha'_w$ as a natural parameter
controlling the degree of uplift.
Figure [16](#fig:lifting_transformations){reference-type="ref"
reference="fig:lifting_transformations"} shows animations of a world of
radius $500$ being uplifted using the different transformation methods
for increasing $\alpha'_w$ parameter.

<figure id="fig:notation2" data-latex-placement="tbp">
<figure id="fig:side_view_notation2">
<embed src="./images/side_view2.pdf" />
<figcaption>A side view of the world.</figcaption>
</figure>
<figure id="fig:angular_tsunami">
<embed src="./images/angular_tsunami.pdf" />
<figcaption>Angular tsunami</figcaption>
</figure>
<figcaption>Angular tsunami</figcaption>
</figure>

<figure id="fig:lifting_coverage" data-latex-placement="tbp">
<figure id="fig:lifting_parabolic_coverage">
<embed src="./images/lifting_parabolic_coverage_500.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_hyperbolic_coverage">
<embed src="./images/lifting_hyperbolic_coverage_500.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_angular_coverage">
<embed src="./images/lifting_angular_coverage_500.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_spherical_coverage">
<embed src="./images/lifting_spherical_coverage_500.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figcaption></figcaption>
</figure>

<figure id="fig:lifting_distance_change" data-latex-placement="tbp">
<figure id="fig:lifting_parabolic_distance_change">
<embed
src="./images/ParabolicTsunami_observer_distance_change_absolute.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_hyperbolic_distance_change">
<embed
src="./images/HyperbolicTsunami_observer_distance_change_absolute.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_angular_distance_change">
<embed
src="./images/AngularTsunami_observer_distance_change_absolute.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_spherical_distance_change">
<embed
src="./images/SphericalTsunami_observer_distance_change_absolute.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figcaption></figcaption>
</figure>

<figure id="fig:lifting_distance_change_relative"
data-latex-placement="tbp">
<figure id="fig:lifting_parabolic_distance_change_relative">
<embed
src="./images/ParabolicTsunami_observer_distance_change_relative.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_hyperbolic_distance_change_relative">
<embed
src="./images/HyperbolicTsunami_observer_distance_change_relative.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_angular_distance_change_relative">
<embed
src="./images/AngularTsunami_observer_distance_change_relative.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_spherical_distance_change_relative">
<embed
src="./images/SphericalTsunami_observer_distance_change_relative.pdf"
style="width:90.0%" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figcaption></figcaption>
</figure>

<figure id="fig:evolution" data-latex-placement="tbp">
<figure id="fig:evolution_parabolic">
<embed src="./images/evolution_parabolic.pdf" />
<figcaption>Parabolic</figcaption>
</figure>
<figure id="fig:evolution_hyperbolic">
<embed src="./images/evolution_hyperbolic.pdf" />
<figcaption>Hyperbolic</figcaption>
</figure>
<figure id="fig:evolution_angular">
<embed src="./images/evolution_angular.pdf" />
<figcaption>Angular</figcaption>
</figure>
<figure id="fig:evolution_spherical">
<embed src="./images/evolution_spherical.pdf" />
<figcaption>Spherical</figcaption>
</figure>
<figcaption>Spherical</figcaption>
</figure>

### Parabolic tsunami

The parabolic tsunami transformation maps the flat ground onto a
parabolic profile. In the vertical viewing plane, the profile is
described by $$(x',z')=(x,px^2),$$ where $p\geq 0$ controls the degree
of uplift.

One advantage of this formulation is that both the tangent and normal
vectors are easy to compute. A tangent vector to the parabolic profile
is $$(1,2px),$$ while a corresponding unit normal vector is
$$\frac{(-2px,1)}{\sqrt{1+4p^2x^2}}.$$

However, although the arc length of a parabola can be expressed
analytically, the resulting arc-length relation cannot be inverted in
closed form. Therefore, to map an original ground point at distance $s$
to a point $P'$ on the parabola while preserving arc length, the
corresponding parameter value $x$ must be found numerically.
Consequently, the value of $p$ that produces a prescribed transformed
boundary angle $\alpha'_w$ must also be determined numerically; see
Section [10.2](#sec:computational_remarks){reference-type="ref"
reference="sec:computational_remarks"}.

The intersection of the parabolic profile with a viewing ray originating
at the observer and pointing in the direction $\mathbf{v}=(v_1,v_2)$ can
be computed directly. The ray is parametrized as
$$\mathbf{r}(t)=(0,h)+t(v_1,v_2), \qquad t\geq 0,$$ and the parabolic
profile is given by $$z=px^2.$$ Substituting $x=tv_1$ and $z=h+tv_2$
into the parabola equation yields $$pv_1^2t^2-v_2t-h=0.$$ The physically
relevant solution is the non-negative value of $t$, corresponding to the
intersection in front of the observer. For $p>0$ and $v_1\neq 0$, the
horizontal coordinate of the intersection is
$$x= \frac{v_2+\sqrt{v_2^2+4pv_1^2h}}{2pv_1},$$ assuming $v_1>0$.

When $p=0$, the profile reduces to the original flat ground. For a
downward-pointing ray, $v_2<0$, the intersection is then given by
$$x=-\frac{v_1h}{v_2}.$$ If $v_1=0$, the ray is vertical: a
downward-pointing ray intersects the profile at the origin, whereas an
upward-pointing ray does not intersect it in front of the observer.

Note that, for any $p>0$, the parabolic profile intersects every viewing
ray with $v_1>0$. Consequently, even an arbitrarily small positive
uplift removes the horizon: every forward viewing direction intersects
the uplifted ground eventually.

### Hyperbolic tsunami

The hyperbolic tsunami transformation is designed not only to raise the
world boundary to the prescribed viewing angle $\alpha'_w$, but also to
keep the horizon beyond the transformed world boundary. In the vertical
viewing plane, the hyperbolic profile is defined by $$(x',z')=
\left(
x,\sqrt{p^2x^2+b^2}-b
\right),$$ where $p\geq 0$ controls the asymptotic slope, and $b\geq 0$
controls how rapidly the profile approaches its asymptote.

More precisely, the profile is a branch of a hyperbola with its vertex
at the origin and the asymptote $$z'=px'-b.$$ Thus, $p$ determines the
slope of the asymptote, whereas $b$ determines its downward offset. In
the limiting case $b=0$, the profile reduces, for $x\geq 0$, to the
straight line $z=px$; the initially flat ground is therefore rotated
about the origin. Since the profile approaches a line of slope $p$, the
transformed horizon is observed at $$\alpha_h=90^\circ+\arctan(p).$$

A tangent vector to the profile is
$$\left(1, \frac{p^2x}{\sqrt{p^2x^2+b^2}}
\right),$$ and a corresponding, generally non-unit, normal vector is
$$\left(
-\frac{p^2x}{\sqrt{p^2x^2+b^2}},
1
\right).$$

The intersection of the hyperbolic profile with a viewing ray can also
be obtained analytically. Let the observer be located at $(0,h)$ and let
the viewing direction be $\mathbf{v}=(v_1,v_2)$. For $v_1\neq 0$, the
ray can be written as $$z=h+qx,$$ where $$q=\frac{v_2}{v_1}$$ is the
slope of the ray.

Substituting the ray equation into the profile equation gives
$$\sqrt{p^2x^2+b^2}=b+h+qx.$$ After squaring and rearranging the terms,
we obtain the quadratic equation $$\left(p^2-q^2\right)x^2
-2(b+h)qx
-h(2b+h)=0.$$

Introducing $$c_1=p^2-q^2,
\qquad
c_2=(b+h)q,$$ the physically relevant intersection in front of the
observer is $$x=
\frac{
c_2+\sqrt{c_2^2+h(2b+h)c_1}
}{
c_1
},$$ provided that $c_1\neq 0$. The positive square-root branch is
selected because it yields the forward intersection with the profile.

When $c_1=0$, that is, when $q^2=p^2$, the quadratic term vanishes and
the equation becomes linear. The intersection is then given by $$x=
-\frac{h(2b+h)}{2c_2}.$$

The asymptote of the profile has slope $p$. Therefore, if
$$v_2\geq pv_1,$$ the viewing ray points along or above the transformed
horizon and has no finite forward intersection with the profile.
Finally, if $v_1=0$, the ray is vertical. A downward-pointing ray
intersects the profile at the origin, whereas an upward-pointing ray
does not intersect it in front of the observer.

Although the arc length of a hyperbola can be expressed analytically,
its arc-length relation cannot, in general, be inverted in closed form.
Consequently, the point $P'$ corresponding to an original ground
distance $s$ must be determined numerically; see
Section [10.2](#sec:computational_remarks){reference-type="ref"
reference="sec:computational_remarks"}.

### Angular tsunami

The angular tsunami transformation is motivated by the following
observation. A flat ground plane is visible over the angular interval
$[0^\circ,90^\circ)$. If each viewing angle is doubled while preserving
the distance from the observer to the corresponding point, the resulting
profile spans the full interval $[0^\circ,180^\circ)$. This
construction, where $d'=d$ and $\alpha'=2\alpha$ is illustrated in
Figure [18](#fig:angular_tsunami){reference-type="ref"
reference="fig:angular_tsunami"}.

Let $h'>0$ denote an effective observer height that controls the degree
of uplift. A point $(s,0)$ on the original ground is seen from the
effective observer position $(0,h')$ at an angle $\alpha$, where
$$\sin\alpha=\frac{s}{d'},
\qquad
\cos\alpha=\frac{h'}{d'},
\qquad
d'=\sqrt{s^2+h'^2}.$$ The transformed point is placed at the same
distance $d'$ from the effective observer, but at the doubled angle
$2\alpha$. Its coordinates are therefore $$x'=d'\sin(2\alpha),
\qquad
z'=h'-d'\cos(2\alpha).$$

Using the double-angle identities, we obtain
$$x'= d' 2\sin\alpha\cos\alpha = 
\frac{2sh'}{\sqrt{s^2+h'^2}},$$ and
$$z' = h'-d'\left(\cos^2\alpha-\sin^2\alpha\right)
=
h'-\frac{h'^2-s^2}{\sqrt{s^2+h'^2}}.$$ Hence, the transformed profile is
given by $$(x',z') =
\left(
\frac{2sh'}{\sqrt{s^2+h'^2}},
h'-\frac{h'^2-s^2}{\sqrt{s^2+h'^2}}
\right).$$

The parameter $h'$ may be interpreted as the effective height from which
the angular remapping is defined. As $h'\to\infty$, the transformed
profile approaches the original flat ground. For convenience, we
therefore use the curvature-like parameter $$p=\frac{1}{h'}$$ to control
the uplift, with $p=0$ corresponding to the flat world.

A tangent vector to the profile is obtained by differentiating with
respect to $s$: $$\left(
\frac{2h'^3}{(h'^2+s^2)^{3/2}},
\frac{s(3h'^2+s^2)}{(h'^2+s^2)^{3/2}}
\right).$$ A corresponding non-unit normal vector is $$\left(
-\frac{s(3h'^2+s^2)}{(h'^2+s^2)^{3/2}},
\frac{2h'^3}{(h'^2+s^2)^{3/2}}
\right).$$

Interestingly, the profile converges to the vertical line $x'=2h'$ as
$s\to\infty$. Similarly to the previous two methods, the point $P'$
corresponding to an original ground distance $s$ must be determined
numerically; see
Section [10.2](#sec:computational_remarks){reference-type="ref"
reference="sec:computational_remarks"}.

The intersection of the angular tsunami profile with a viewing ray can
be found analytically up to the solution of a quartic polynomial. Let
the observer be located at $(0,h)$, let the viewing direction be
$\mathbf{v}=(v_1,v_2)$, and let $p>0$ denote the uplift parameter.
Introducing the dimensionless profile parameter $$t=s/h'=p s,$$ the
angular profile can be written as $$x(t)=\frac{2t}{p\sqrt{1+t^2}},
\qquad
z(t)=\frac{1}{p}
\left(
1-\frac{1-t^2}{\sqrt{1+t^2}}
\right).$$

A point $(x,z)$ lies on the viewing ray if the vector from the observer
to the point is parallel to $\mathbf{v}$. Hence, $$v_1(z-h)-v_2x=0.$$
Substituting the angular profile into this equation and multiplying by
$p\sqrt{1+t^2}$ gives $$v_1(1-hp)\sqrt{1+t^2} =
v_1(1-t^2)+2v_2t.$$ Squaring both sides eliminates the square root and
yields the quartic equation $$v_1^2t^4
-4v_1v_2t^3
+
\left(
4v_2^2-2v_1^2-q
\right)t^2
+
4v_1v_2t
+
v_1^2-q
=
0,$$ where $$q=v_1^2(1-hp)^2.$$

The real non-negative roots of this polynomial provide candidate
intersections. For each candidate $t$, the corresponding profile
parameter is $$s=\frac{t}{p}.$$ However, squaring the intersection
equation may introduce extraneous roots. Each candidate must therefore
be substituted back into the original unsquared equation,
$$v_1(1-hp)\sqrt{1+t^2}-v_1(1-t^2)-2v_2t=0.$$ In addition, the candidate
must lie on the forward half-ray. This can be verified by computing
$$\lambda=\frac{x(t)}{v_1}$$ for $v_1\neq0$ and requiring
$\lambda\geq0$. If several valid intersections remain, the smallest
non-negative value of $\lambda$ corresponds to the first point
encountered along the viewing ray and should normally be selected.

Two limiting cases are handled separately. If $p=0$, the profile reduces
to the original flat ground. A downward-pointing ray then intersects it
at $$s=-\frac{v_1h}{v_2},
\qquad v_2<0,$$ whereas a horizontal or upward-pointing ray has no
finite intersection. If $v_1=0$, the ray is vertical: a
downward-pointing ray intersects the profile at the origin, while an
upward-pointing ray does not intersect the profile in front of the
observer.

### Spherical tsunami

The spherical tsunami transformation maps the flat ground onto a
circular arc. Let $p\geq0$ denote the curvature of the profile and let
$$r=\frac{1}{p}$$ be the corresponding radius. For $p>0$, the
transformed profile is parametrized by $$(x',z')=
\left(
\frac{\sin(p s)}{p},
\frac{1-\cos(p s)}{p}
\right).$$ Equivalently, $$(x',z')
=
\left(
r\sin\frac{s}{r},
r-r\cos\frac{s}{r}
\right).$$ The profile is therefore an arc of the circle
$${x'}^2+(z'-r)^2=r^2,$$ whose centre is located at $(0,r)$ and which
passes through the origin. In the limiting case $p\to0$, the circular
arc converges to the original flat ground, $$(x',z')\to(s,0).$$

Unlike the preceding transformations, the spherical profile is
parametrized directly by arc length. Indeed, differentiating with
respect to $s$ gives the unit tangent vector $$\left(
\cos(p s),
\sin(p s)
\right),$$ whose norm is equal to one. Consequently, the arc length from
the origin to the point corresponding to parameter $s$ is exactly $s$,
and no numerical arc-length reparametrization is required.

A unit normal pointing locally above the transformed ground is $$\left(
-\sin(p s),
\cos(p s)
\right).$$ At the origin, where $s=0$, this normal equals $(0,1)$ and
therefore agrees with the upward normal of the original flat ground.

The parameter $p$ controls the degree of uplift. As $p$ increases, the
profile bends more strongly. To avoid wrapping the modelled world beyond
the first semicircle, we restrict the parameter to
$$0\leq p\leq\frac{\pi}{\ensuremath{d_{w}}}.$$ At the upper limit, the
world boundary reaches the point $$\left(
0,
\frac{2\ensuremath{d_{w}}}{\pi}
\right),$$ after traversing half of the circle.

The intersection of the spherical profile with a viewing ray can be
obtained analytically. Let the observer be located at $(0,h)$ and let
the ray have direction $$\mathbf{v}=(v_1,v_2).$$ After normalizing
$\mathbf{v}$, the ray is parametrized as $$\mathbf{r}(t) =
(0,h)+t(v_1,v_2),
\qquad
t\geq0.$$ Substituting $$x=t v_1,
\qquad
z=h+t v_2$$ into the circle equation $$x^2+(z-r)^2=r^2$$ gives $$t^2
+
2v_2(h-r)t
+
h(h-2r)
=
0.$$ The forward intersection is therefore obtained from $$t
=
v_2(r-h)
+
\sqrt{
v_2^2(r-h)^2+h(2r-h)
}.$$ The second solution corresponds to the intersection in the opposite
direction along the same line and is therefore discarded.

The implementation restricts the transformation to configurations
satisfying $$hp\leq2,$$ or equivalently $$h\leq2r.$$ Under this
condition, the observer lies inside or on the circular profile, and
every viewing direction intersects the circle in the forward direction.
If $hp>2$, the observer lies outside the circle, and some viewing rays
may have no forward intersection.

Once the ray parameter $t$ has been found, the intersection coordinates
are $$x=t v_1,
\qquad
z=h+t v_2.$$ The corresponding central angle of the circular arc is
$$\theta
=
\operatorname{atan2}(x,r-z),$$ and, because the profile is parametrized
by arc length, the ground parameter is obtained directly as
$$s=r|\theta|.$$

If $p=0$, the profile reduces to the original flat ground. A
downward-pointing ray then intersects it at $$s=-\frac{v_1h}{v_2},
\qquad v_2<0,$$ whereas a horizontal or upward-pointing ray has no
finite intersection.

To obtain a prescribed viewing angle $\alpha'_w$ of the transformed
world boundary, the corresponding parameter $p$ is found numerically.
Since only the first semicircular branch is considered, the search is
restricted to $$p\in
\left[
0,\frac{\pi}{\ensuremath{d_{w}}}
\right].$$ For a given $p$, the boundary point is evaluated directly
using the arc-length parameter $s=\ensuremath{d_{w}}$, and its viewing
angle from the observer is compared with the desired value $\alpha'_w$.
Because the boundary angle varies monotonically over the selected
interval, the required curvature can be determined efficiently using
bisection.

## Computational remarks {#sec:computational_remarks}

The four tsunami transformations differ in their analytic form, but they
share several computational requirements. In particular, the
transformation must preserve arc length, points must be located
efficiently from viewing directions, and the uplift parameter must be
determined for a prescribed transformed boundary angle $\alpha'_w$. Some
of these operations admit closed-form solutions for particular methods,
whereas others require numerical inversion. To avoid repeating expensive
computations during rendering, we precompute the required mappings and
store them in lookup tables.

### Arc-length parametrization

Let a tsunami profile be given by a parameterized curve
$$\mathbf{g'}(t)=\bigl(x(t),z(t)\bigr).$$ Its arc length from the origin
to the point corresponding to the parameter value $t$ is $$s'(t)=
\int_0^t
\left\lVert
\frac{\mathrm{d}\mathbf{g}'(\tau)}{\mathrm{d}\tau}
\right\rVert
\,\mathrm{d}\tau
=
\int_0^t
\sqrt{
\left(\frac{\mathrm{d}x}{\mathrm{d}\tau}\right)^2
+
\left(\frac{\mathrm{d}z}{\mathrm{d}\tau}\right)^2
}
\,\mathrm{d}\tau.$$ To preserve distances along the ground, a point
originally located at distance $s$ must be mapped to the point
$$T(s)=\mathbf{g'}\bigl(t(s)\bigr),$$ where $t(s)$ is the inverse of the
arc-length function and satisfies $$s'\bigl(t(s)\bigr)=s.$$

For the spherical transformation, the profile is already parametrized by
arc length, because the derivative of $\mathbf{g}'$ is equal to 1
everywhere. Hence, $t(s)=s$ and no numerical inversion is required. For
the parabolic, hyperbolic, and angular transformations, the profile
parameter is not generally equal to arc length. Although the
corresponding arc-length functions may be available analytically or
through numerical integration, their inverses are not available in a
convenient closed form. The parameter $t(s)$ must therefore be found
numerically.

A direct approach is to solve $$s'(t)-s=0$$ using a one-dimensional
root-finding method such as bisection. Since $s'(t)$ is monotonically
increasing for the considered profiles, the solution is unique and
bisection is robust. However, performing this computation separately for
every point during rendering would be prohibitively expensive.

Instead, we sample the profile parameter at values
$$t_0,t_1,\ldots,t_n$$ and compute the corresponding cumulative arc
lengths $$s'_i=s'(t_i).$$ The inverse mapping $t(s)$ is then
approximated by interpolation between the pairs $(s'_i,t_i)$. The
transformed coordinates of a ground point at distance $s$ are evaluated
as $$T(s)
\approx
\mathbf{g'}\bigl(\widetilde{t}(s)\bigr),$$ where $\widetilde{t}$ denotes
the interpolated inverse arc-length function.

The accuracy of this approximation depends on the number and
distribution of samples. Uniform sampling in $t$ is sufficient for
moderately curved profiles, whereas adaptive sampling may be beneficial
when curvature changes rapidly. In practice, a dense one-dimensional
table provides a good compromise between accuracy, memory consumption,
and computational cost.

### Determining the uplift parameter

For each transformation, the degree of uplift is controlled by a
parameter $p$. Given the observer height $h$, the world radius
$\ensuremath{d_{w}}$, and a prescribed transformed boundary angle
$\alpha'_w$, we seek a value of $p$ such that $$\alpha'_w
=
\alpha'\bigl(\ensuremath{d_{w}};p\bigr).$$

This relation cannot generally be inverted analytically. We therefore
define $$F(p)
=
\alpha'\bigl(\ensuremath{d_{w}};p\bigr)-\alpha'_w$$ and solve $$F(p)=0$$
numerically. For the considered range of parameters, the viewing angle
of the world boundary increases monotonically with $p$, which makes
bisection a suitable and stable choice.

The initial interval for bisection is obtained differently for bounded
and unbounded methods. For transformations whose parameter is not
naturally bounded, the upper limit is found by repeatedly increasing the
parameter until the resulting boundary angle exceeds the target value.
For the spherical transformation, the search is restricted to the first
semicircular branch, $$0\leq p\leq
\frac{\pi}{\ensuremath{d_{w}}}.$$ This prevents the ground from winding
around the circle and ensures that the boundary angle varies
monotonically over the search interval.

When parameters are needed for an increasing sequence of target angles,
the parameter found for the preceding angle can be reused as the lower
bound for the next search. Since the required parameter values are also
increasing, this significantly reduces the number of evaluations.

For interactive visualization, we precompute the parameter values
corresponding to a discrete sequence of target boundary angles,
$$\alpha'_{w,0},
\alpha'_{w,1},
\ldots,
\alpha'_{w,m}.$$ The resulting pairs $$\bigl(\alpha'_{w,i},p_i\bigr)$$
can be stored in a lookup table and reused by sliders, animations, and
comparative experiments. This also ensures that all transformation
methods are evaluated at corresponding uplift levels.

### Intersection with viewing rays

To render the transformed world, it is often necessary to determine
which ground point is visible in a given viewing direction. Let the
observer be located at $(0,h)$ and let $$\mathbf{v}=(v_1,v_2)$$ be a
direction in the vertical viewing plane. The viewing ray is
$$\mathbf{r}(t)
=
(0,h)+t\mathbf{v},
\qquad
t\geq0.$$

For the parabolic, hyperbolic, and spherical profiles, the intersection
can be computed directly by solving a quadratic equation or, in the
spherical case, by intersecting the ray with a circle. For the angular
profile, substitution leads to a quartic polynomial. Its real
non-negative roots provide candidate intersections, but roots introduced
by squaring must be rejected by substituting them back into the original
equation. If more than one valid intersection remains, the first
intersection along the ray is selected, that is, the one with the
smallest non-negative ray parameter $t$.

Special cases should be treated explicitly. These include the flat
profile $p=0$, vertical rays with $v_1=0$, and rays pointing above the
transformed horizon. Handling such cases separately improves both
numerical stability and performance.

### Angle-to-distance lookup tables

Even when an analytic ray--profile intersection is available, evaluating
it independently for every image pixel can be expensive. Moreover, the
intersection is usually expressed in terms of the native profile
parameter $t$, whereas rendering requires the original ground distance
$s$, represented by arc length.

For a fixed observer height and uplift parameter, we therefore
precompute a lookup table relating the viewing angle $\alpha$ to the
visible ground distance $s$. Let $$\alpha_i
=
\frac{i}{n-1}\alpha_{\max},
\qquad
i=0,\ldots,n-1,$$ be a dense sampling of viewing directions. For each
$\alpha_i$, we define $$\mathbf{v}_i
=
\bigl(
\sin\alpha_i,
-\cos\alpha_i
\bigr)$$ and compute the corresponding profile parameter $$t_i
=
t_{\mathrm{seen}}(\mathbf{v}_i,h).$$ The original ground distance is
then $$s_i=s'(t_i).$$

This produces two arrays, $$(\alpha_0,\ldots,\alpha_{n-1})
\quad\text{and}\quad
(s_0,\ldots,s_{n-1}),$$ which define the mapping $$\alpha\mapsto d.$$
During rendering, the distance visible at an arbitrary angle is obtained
by one-dimensional interpolation: $$d(\alpha)
\approx
\operatorname{interp}
\bigl(
\alpha;
{\alpha_i},
{d_i}
\bigr).$$

This approach is particularly effective because all pixels in a
horizontal image row share the same vertical viewing angle in the
directional
formulation [10.3.2](#sec:directional_tsunami){reference-type="ref"
reference="sec:directional_tsunami"}. Thus, only one distance value
needs to be evaluated per row, after which it can be broadcast across
the image width. In the radial
formulation [10.3.1](#sec:radial_tsunami){reference-type="ref"
reference="sec:radial_tsunami"}, the corresponding angle is computed for
every pixel, but the expensive geometric inversion is still replaced by
a fast table lookup.

The lookup table must remain monotonic in the region used for
interpolation. Invalid intersections are represented by infinity or by a
dedicated mask and should not be passed directly through ordinary
interpolation. Before constructing the table, non-finite values should
be removed or handled explicitly, and repeated angle values should be
merged.

### Precomputation and caching

The most expensive quantities depend only on a small number of global
parameters, such as the observer height, the world radius, the
transformation type, and the uplift parameter. They can therefore be
cached and reused until one of these values changes.

Typical precomputed quantities include:

- the inverse arc-length mapping $t(s)$;

- the viewing-angle-to-distance mapping $\alpha\mapsto s$;

- the parameter values $p_i$ corresponding to prescribed boundary angles
  $\alpha'_{w,i}$;

- sampled coordinates and normals of the uplifted profile.

When the observer direction or camera field of view changes, these
tables usually remain valid. By contrast, changing the observer height
or the uplift parameter requires rebuilding the angle-to-distance table,
and changing the profile shape requires rebuilding the arc-length
parametrization as well.

For animations and systematic comparisons, the lookup tables may be
precomputed for all discrete uplift levels and stored in files. A
two-dimensional table can then represent $$s_{ij}
=
s(\alpha_j;p_i),$$ where rows correspond to uplift levels and columns
correspond to viewing angles. Such a table supports efficient generation
of animations, coverage plots, and the colour-strip evolution shown in
Figure [39](#fig:evolution){reference-type="ref"
reference="fig:evolution"}.

### Numerical robustness

Several practical precautions improve numerical stability. Comparisons
with zero should use a tolerance rather than exact equality, especially
for the flat-profile limit. Expressions involving square roots should be
protected against small negative values caused by rounding. Candidate
polynomial roots should be filtered using both their imaginary part and
the residual of the original equation. Finally, the ordering of roots
returned by a numerical polynomial solver must not be assumed to have
geometric meaning.

Bisection is preferred over faster open methods whenever a reliable
bracket is available. Although methods such as Newton iteration may
converge more rapidly, they are more sensitive to the initial estimate
and may jump between multiple branches. Since most expensive mappings
are precomputed only occasionally, robustness is generally more
important than minimizing the number of iterations.

Overall, the combination of analytic intersections, numerical arc-length
inversion, and precomputed lookup tables makes the tsunami
transformations practical for interactive rendering. Expensive geometric
computations are performed only when the global configuration changes,
while the per-pixel evaluation is reduced primarily to interpolation and
array operations.

## Two-dimensional tsunami extension {#sec:2d_tsunami}

The transformations introduced in
section [10.1](#sec:1d_tsunami){reference-type="ref"
reference="sec:1d_tsunami"} act in a single vertical plane. To apply
them to a two-dimensional ground surface, the one-dimensional profile
must be extended over the horizontal plane.

Let $$T_1(s)=\bigl(x'(s),z'(s)\bigr),
\qquad s\geq0,$$ denote one of the one-dimensional tsunami
transformations. The value $s$ represents the original ground distance,
$x'(s)$ is the corresponding horizontal coordinate after uplifting, and
$z'(s)$ is the resulting height. If arc length is preserved, the
distance measured along the transformed profile from the origin to
$T_1(s)$ remains equal to $s$.

The original ground is represented by points $$P=(x,y,0),$$ and the
observer is located above the origin. Let
$$\mathbf{u}=(u_x,u_y)=(\cos\ensuremath{\phi},\sin\ensuremath{\phi})$$
be the horizontal unit vector corresponding to the observer's viewing
direction. Extending $T_1$ to the plane is not unique, because a
two-dimensional point may be associated either with its radial distance
from the origin, with its distance along the viewing direction, or with
a combination of both. We consider three such extensions: radial,
directional, and mixed.

<figure id="fig:lifting_in_space" data-latex-placement="tbp">
<figure id="fig:camera_original">
<embed src="./images/camera_original_alpha65_az0_h101_500.pdf" />
<figcaption>Camera view of non-lifted plane</figcaption>
</figure>
<figure id="fig:parabolic_radial">
<embed
src="./images/ParabolicTsunami_radial_alpha65p0_az0_h101_level10_camera_tsunami.pdf" />
<figcaption>Radial uplifting</figcaption>
</figure>
<figure id="fig:parabolic_directional">
<embed
src="./images/ParabolicTsunami_directional_alpha65p0_az0_h101_level10_camera_tsunami.pdf" />
<figcaption>Directional uplifting</figcaption>
</figure>
<figure id="fig:parabolic_mixed">
<embed
src="./images/ParabolicTsunami_mixed_alpha65p0_az0_h101_level10_camera_tsunami.pdf" />
<figcaption>Mixed uplifting</figcaption>
</figure>
<figure id="fig:parabolic_sideview">
<embed
src="./images/ParabolicTsunami_directional_alpha65p0_az0_h101_level10_side_view.pdf" />
<figcaption>Side view</figcaption>
</figure>
<figure id="fig:parabolic_radial_topview">
<embed
src="./images/ParabolicTsunami_radial_alpha65p0_az0_h101_level10_top_view.pdf" />
<figcaption>FOV (magenta) of radial uplifting</figcaption>
</figure>
<figure id="fig:parabolic_directional_topview">
<embed
src="./images/ParabolicTsunami_directional_alpha65p0_az0_h101_level10_top_view.pdf" />
<figcaption>FOV (magenta) of directional uplifting</figcaption>
</figure>
<figure id="fig:parabolic_mixed_topview">
<embed
src="./images/ParabolicTsunami_mixed_alpha65p0_az0_h101_level10_top_view.pdf" />
<figcaption>FOV (magenta) of mixed uplifting</figcaption>
</figure>
<figcaption>FOV (magenta) of mixed uplifting</figcaption>
</figure>

Figure [48](#fig:lifting_in_space){reference-type="ref"
reference="fig:lifting_in_space"} compares the resulting images and
visible regions for the same one-dimensional parabolic profile.
Figure [40](#fig:camera_original){reference-type="ref"
reference="fig:camera_original"} shows the original flat plane, while
Figures [41](#fig:parabolic_radial){reference-type="ref"
reference="fig:parabolic_radial"}--[43](#fig:parabolic_mixed){reference-type="ref"
reference="fig:parabolic_mixed"} show the camera views produced by the
three extensions. Their corresponding visible regions in the ground
plane are shown in
Figures [45](#fig:parabolic_radial_topview){reference-type="ref"
reference="fig:parabolic_radial_topview"}--[47](#fig:parabolic_mixed_topview){reference-type="ref"
reference="fig:parabolic_mixed_topview"}. The side view in
Figure [44](#fig:parabolic_sideview){reference-type="ref"
reference="fig:parabolic_sideview"} is common to all three methods along
the central viewing direction; the methods differ in how this profile is
propagated laterally.

### Radial tsunami {#sec:radial_tsunami}

The most direct two-dimensional extension is obtained by applying the
one-dimensional transformation radially around the origin. For a ground
point $$P=(x,y,0),$$ let $$r=\sqrt{x^2+y^2}$$ be its distance from the
origin and let $$\mathbf{e}_r=
\frac{1}{r}(x,y)$$ be its horizontal radial direction for $r>0$. The
radial tsunami transformation is then defined by
$$T_{\mathrm{rad}}(x,y)=
\left(
x'(r)\frac{x}{r},
x'(r)\frac{y}{r},
z'(r)
\right).$$ The origin is mapped to itself.

Thus, every vertical half-plane passing through the vertical axis
contains the same one-dimensional tsunami profile. Circles centred at
the origin remain circles, although their radii and heights change
according to the profile. The resulting surface is rotationally
symmetric and independent of the observer's azimuth.

This construction is geometrically natural when the tsunami uplift is
interpreted as a phenomenon spreading uniformly from the observer's
position. It also preserves the original radial organisation of the
world: all points at the same distance from the origin are lifted to the
same height.

However, the radial construction does not distinguish between the
forward viewing direction and lateral directions. The one-dimensional
transformation is applied equally strongly across the entire field of
view. Consequently, the apparent deformation depends on both the
vertical and horizontal viewing angles. Straight ground structures that
are perpendicular to the viewing direction may therefore become
noticeably curved in the image. This effect can be seen in
Figure [41](#fig:parabolic_radial){reference-type="ref"
reference="fig:parabolic_radial"}, while the corresponding transformed
field of view is shown in
Figure [45](#fig:parabolic_radial_topview){reference-type="ref"
reference="fig:parabolic_radial_topview"}.

For rendering, the radial method can be evaluated efficiently using the
angle-to-distance lookup table described in
Section [10.2](#sec:computational_remarks){reference-type="ref"
reference="sec:computational_remarks"}. For each camera ray, we compute
the angle $$\theta
=
\operatorname{atan2}
\left(
\sqrt{v_x^2+v_y^2},
-v_z
\right)$$ between the downward vertical direction and the ray. The
lookup table then provides the radial ground distance visible in this
direction.

### Directional tsunami {#sec:directional_tsunami}

The directional extension is motivated by the fact that the original
one-dimensional profile is defined in the vertical plane containing the
viewing direction. Instead of rotating this profile around the origin,
we replicate it in parallel vertical planes.

Let $\mathbf{u}$ be the horizontal viewing direction and let
$$\mathbf{u}_{\perp}=(-u_y,u_x)$$ be a perpendicular horizontal unit
vector. Every ground point can be decomposed as $$(x,y)=
s\,\mathbf{u}
+
q\,\mathbf{u}_{\perp},$$ where $$s=(x,y)\cdot\mathbf{u},
\qquad
q=(x,y)\cdot\mathbf{u}_{\perp}.$$ The directional transformation applies
the one-dimensional tsunami only to the forward coordinate $s$, while
leaving the lateral coordinate $q$ unchanged: $$T_{\mathrm{dir}}(x,y)=
x'(s)\mathbf{u}
+
q\mathbf{u}_{\perp}
+
z'(s)\mathbf{e}_z,$$ where $\mathbf{e}_z=(0,0,1).$ In Cartesian
coordinates, this can be written as $$T_{\mathrm{dir}}(x,y)=
\left(
x'(s)u_x-qu_y,\,
x'(s)u_y+qu_x,\,
z'(s)
\right).$$

The resulting surface is cylindrical rather than rotationally symmetric.
Every vertical plane parallel to the viewing direction contains an
identical copy of the one-dimensional tsunami profile. In contrast, the
surface remains unchanged along the lateral direction.

This construction is particularly suitable when the purpose of the
transformation is to redistribute depth in the observer's viewing
direction. All camera rays in the same image row share the same vertical
viewing angle and therefore receive the same forward distance. The
transformation consequently preserves lateral relationships more
faithfully than the radial method. In particular, structures
perpendicular to the viewing direction are less affected by lateral
bending, as illustrated in
Figure [42](#fig:parabolic_directional){reference-type="ref"
reference="fig:parabolic_directional"}.

The directional extension is also computationally efficient. Because the
transformed distance depends only on the vertical image coordinate, the
one-dimensional angle-to-distance mapping needs to be evaluated only
once for each image row. The resulting forward distances can then be
broadcast across all columns. For an off-centre pixel, the forward
distance is converted to the corresponding horizontal distance along its
camera ray.

The method is, however, explicitly dependent on the observer's viewing
direction. If the azimuth changes, the direction in which the
one-dimensional profile is propagated must change as well. Moreover, the
cylindrical surface does not treat all directions around the observer
equally. The visible region therefore differs substantially from the
rotationally symmetric region produced by radial uplifting, as shown in
Figure [46](#fig:parabolic_directional_topview){reference-type="ref"
reference="fig:parabolic_directional_topview"}.

### Mixed tsunami {#sec:mixed_tsunami}

The radial and directional extensions have complementary advantages. The
radial method is geometrically symmetric and naturally tied to the
distance from the origin, but it may introduce strong lateral curvature
in the camera image. The directional method preserves the structure
across the viewing direction more effectively, but it introduces a
preferred horizontal direction and may produce a less natural
transformation away from the central viewing plane.

The mixed method is designed as a compromise between these two
behaviours. Rather than defining another explicit uplifted surface, we
combine the ground-distance fields obtained from the radial and
directional constructions.

Let $$s_{\mathrm{rad}}(\mathbf{v})$$ and
$$s_{\mathrm{dir}}(\mathbf{v})$$ denote the original ground distances
visible along a camera ray with direction $\mathbf{v}$ under the radial
and directional transformations, respectively. For a mixing parameter
$$\mu\in[0,1],$$ the mixed distance is defined using reciprocal
interpolation: $$\frac{1}{s_{\mathrm{mix}}}=
\frac{1-\mu}{s_{\mathrm{dir}}}
+
\frac{\mu}{s_{\mathrm{rad}}}.$$ Equivalently, $$s_{\mathrm{mix}}=
\left(
\frac{1-\mu}{s_{\mathrm{dir}}}
+
\frac{\mu}{s_{\mathrm{rad}}}
\right)^{-1}.$$

The limiting values recover the original methods:
$$s_{\mathrm{mix}}=s_{\mathrm{dir}}
\quad\text{for }\mu=0,$$ and $$s_{\mathrm{mix}}=s_{\mathrm{rad}}
\quad\text{for }\mu=1.$$ Intermediate values gradually introduce radial
behaviour into the directional distance field.

Reciprocal interpolation is preferable to a direct arithmetic average in
this context because the distance along a viewing ray plays a role
analogous to inverse depth in perspective projection. It also reduces
the influence of very large distances and provides a stable transition
when one method approaches the horizon. If only one of the two methods
yields a finite valid intersection, that value can be retained instead
of combining it with an invalid result.

The mixed construction should be interpreted primarily as a
view-dependent mapping rather than as the projection of a uniquely
defined three-dimensional surface. The interpolated distance field does
not necessarily correspond exactly to the intersection of every ray with
one globally consistent surface. Nevertheless, it provides a practical
way to balance radial symmetry against the lateral stability of the
directional method.

The choice of $\mu$ may be fixed globally or selected according to an
image-space criterion. For example, it can be chosen to reduce the
curvature or irregularity of the projected world boundary.
Figure [43](#fig:parabolic_mixed){reference-type="ref"
reference="fig:parabolic_mixed"} shows that an intermediate mixture can
retain much of the natural depth redistribution of the radial method
while reducing some of its lateral distortion. The corresponding field
of view in
Figure [47](#fig:parabolic_mixed_topview){reference-type="ref"
reference="fig:parabolic_mixed_topview"} lies between those obtained by
the radial and directional extensions.

In all three methods, the underlying one-dimensional tsunami profile
remains unchanged. The difference lies only in how the one-dimensional
distance coordinate is extended over the plane: the radial method uses
distance from the origin, the directional method uses distance along the
viewing direction, and the mixed method combines the two resulting
ray-distance fields.

<figure id="fig:lifting_comparison" data-latex-placement="tbp">
<figure id="fig:lifting_parabolic_3D">
<embed
src="./images/ParabolicTsunami_mixed_alpha65p0_az0_h101_level10_camera_tsunami.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_hyperbolic_3D">
<embed
src="./images/HyperbolicTsunami_mixed_alpha65p0_az0_h101_level10_camera_tsunami.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_angular_3D">
<embed
src="./images/AngularTsunami_mixed_alpha65p0_az0_h101_level10_camera_tsunami.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_spherical_3D">
<embed
src="./images/SphericalTsunami_mixed_alpha65p0_az0_h101_level10_camera_tsunami.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_parabolic_topview">
<embed
src="./images/ParabolicTsunami_mixed_alpha65p0_az0_h101_level10_top_view.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_hyperbolic_topview">
<embed
src="./images/HyperbolicTsunami_mixed_alpha65p0_az0_h101_level10_top_view.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_angular_topview">
<embed
src="./images/AngularTsunami_mixed_alpha65p0_az0_h101_level10_top_view.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_spherical_topview">
<embed
src="./images/SphericalTsunami_mixed_alpha65p0_az0_h101_level10_top_view.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_parabolic_sideview">
<embed
src="./images/ParabolicTsunami_mixed_alpha65p0_az0_h101_level10_side_view.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_hyperbolic_sideview">
<embed
src="./images/HyperbolicTsunami_mixed_alpha65p0_az0_h101_level10_side_view.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_angular_sideview">
<embed
src="./images/AngularTsunami_mixed_alpha65p0_az0_h101_level10_side_view.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:lifting_spherical_sideview">
<embed
src="./images/SphericalTsunami_mixed_alpha65p0_az0_h101_level10_side_view.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figcaption></figcaption>
</figure>

## Three-dimensional tsunami extension {#sec:3d_extension}

The one-dimensional transformations introduced in
Section [10.1](#sec:1d_tsunami){reference-type="ref"
reference="sec:1d_tsunami"} describe the deformation of the ground in a
vertical plane. To apply the tsunami transformation to a
three-dimensional scene, we first extend the transformed profile to a
two-dimensional reference surface and then define the positions of
points above and below this surface using normal coordinates.

<figure id="fig:zero_planes" data-latex-placement="tbp">
<figure id="fig:zero_plane_0">
<embed src="./images/city_zero_plane_0.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:zero_plane_30">
<embed src="./images/city_zero_plane_30.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:zero_plane_70">
<embed src="./images/city_zero_plane_70.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figure id="fig:zero_plane_minus_40">
<embed src="./images/city_zero_plane_minus_40.pdf" />
<figcaption aria-hidden="true"></figcaption>
</figure>
<figcaption></figcaption>
</figure>

### Reference zero plane

Let the original modelled world occupy the cylindrical domain
$$\mathcal{W}=
\left\{
(x,y,z)\in\mathbb{R}^3:
x^2+y^2\leq \ensuremath{d_{w}}^2\,;
h_{\min}\leq z\leq h_{\max}
\right\},$$ where $$h_w=h_{\max}-h_{\min}$$ is the total height of the
modelled world.

We introduce a horizontal reference plane, called the *zero plane*, at
height $h_0$, where $$h_{\min}\leq h_0\leq h_{\max}.$$ For convenience,
the vertical coordinate may be shifted so that $h_0=0$. A point
$$P=(x,y,h_P)$$ is then represented by its position $(x,y)$ in the zero
plane and its signed height $$q=h_P-h_0.$$ Positive values of $q$
correspond to points above the zero plane, while negative values
correspond to points below it.

The location of the zero plane need not coincide with the lowest point
of the scene. Placing it between $h_{\min}$ and $h_{\max}$ makes it
possible to distribute the deformation between the parts of the world
above and below the reference plane. This choice becomes important
because normal layers on one side of a curved surface are compressed,
whereas layers on the opposite side are expanded.

### Transformation of the zero plane

Let $$\mathbf{S}(x,y)=
\bigl(
S_x(x,y),
S_y(x,y),
S_z(x,y)
\bigr)$$ denote the transformed position of the point $(x,y,h_0)$ of the
zero plane. The transformed zero plane is therefore the surface
$$\mathcal{S}=
\left\{
\mathbf{S}(x,y):
x^2+y^2\leq \ensuremath{d_{w}}^2
\right\}.$$

The surface $\mathcal{S}$ is constructed from one of the one-dimensional
tsunami profiles described in
Section [10.1](#sec:1d_tsunami){reference-type="ref"
reference="sec:1d_tsunami"}. Different extensions of the same profile
lead to different spatial transformations. In particular, we consider
directional and radial extensions, which are described in
Sections [10.4.4](#sec:directional_extension){reference-type="ref"
reference="sec:directional_extension"}
and [10.4.5](#sec:radial_extension){reference-type="ref"
reference="sec:radial_extension"}, respectively.

Let $$\mathbf{n}(x,y)$$ be a consistently oriented unit normal to
$\mathcal{S}$. The three-dimensional tsunami transformation of a point
$$P=(x,y,h_P)$$ is defined by $$T_3(P)=
\mathbf{S}(x,y)
+
g(x,y,q)\,\mathbf{n}(x,y),
\qquad
q=h_P-h_0,$$ where $g$ determines how signed height is mapped after the
zero plane has been transformed.

The simplest choice is $$g(x,y,q)=q.$$ In this case, the signed distance
from the zero plane is preserved. Object heights are measured along the
normal of the transformed reference surface, and initially vertical
objects become locally perpendicular to the uplifted ground. This
construction is geometrically natural: the height of an object does not
change, and its base remains attached to the corresponding point of the
transformed zero plane.

Although normal distances are preserved, horizontal dimensions generally
are not. As the zero plane bends, neighbouring normals may converge or
diverge. Objects above the surface can therefore be compressed in
directions tangent to the zero plane, while objects below it can be
expanded, or vice versa, depending on the orientation and curvature of
the surface.

### Deformation of normal layers

The local deformation of the world can be described using the principal
curvatures of the transformed zero plane. Let $$\kappa_1(x,y),
\qquad
\kappa_2(x,y)$$ denote its two signed principal curvatures, and let
$$\mathbf{e}_1(x,y),
\qquad
\mathbf{e}_2(x,y)$$ be the corresponding principal directions.

For the rigid-height transformation $$T_3(x,y,q)=
\mathbf{S}(x,y)+q\mathbf{n}(x,y),$$ the local scale factors at normal
distance $q$ are $$\sigma_1(x,y,q)=1-q\kappa_1(x,y)$$ and
$$\sigma_2(x,y,q)=1-q\kappa_2(x,y)$$ in the two principal directions.
The scale factor in the normal direction remains equal to one.

Thus, a small surface element is changed by the factor $$J(x,y,q)=
\left(1-q\kappa_1(x,y)\right)
\left(1-q\kappa_2(x,y)\right).$$ This quantity is also the local
volume-change factor of the three-dimensional normal-coordinate
transformation.

If $$0<1-q\kappa_i<1,$$ the world is compressed in the corresponding
principal direction. If $$1-q\kappa_i>1,$$ it is expanded. A critical
situation occurs when $$1-q\kappa_i=0.$$ At this distance, neighbouring
surface normals intersect, the transformation becomes locally singular,
and the ordering of nearby points is no longer preserved.

The reciprocal value $$R_i=\frac{1}{|\kappa_i|}$$ is the local principal
radius of curvature. Consequently, the height of objects should remain
sufficiently smaller than the relevant curvature radii. A conservative
admissibility condition is $$|q|\,\max\left(
|\kappa_1|,
|\kappa_2|
\right)
\leq\eta,
\qquad
0<\eta<1,$$ where $\eta$ is a safety factor. In our visualisations, we
use $\eta=0.9$. The corresponding local safe height is
$$h_{\mathrm{safe}}(x,y) =
\frac{\eta}{
\max\left(
|\kappa_1(x,y)|,
|\kappa_2(x,y)|
\right)
},$$ with $h_{\mathrm{safe}}=\infty$ when both principal curvatures
vanish.

The admissible distances above and below the zero plane should, more
precisely, be considered separately because their critical values depend
on the signs of the principal curvatures. This also means that the
choice of $h_0$ can reduce the maximum deformation. For example, placing
the zero plane near the vertical centre of the world distributes the
required normal range between its two sides, whereas placing it at
ground level assigns the entire object height to one side of the curved
surface.

### Directional extension {#sec:directional_extension}

In the directional extension, the one-dimensional tsunami profile is
applied only in a selected horizontal direction. Let
$$\mathbf{v}=(v_x,v_y)$$ be a unit vector in the horizontal plane,
typically corresponding to the viewing azimuth, and let
$$\mathbf{u}=(-v_y,v_x)$$ be the perpendicular horizontal direction.

A point of the zero plane can be written as $$(x,y)=
s\mathbf{v}+r\mathbf{u},$$ where $$s=xv_x+yv_y,
\qquad
r=-xv_y+yv_x.$$ If the one-dimensional tsunami profile maps $s$ to
$$\bigl(X(s),Z(s)\bigr),$$ the transformed zero plane is
$$\mathbf{S}_{\mathrm{dir}}(s,r)=
X(s)\mathbf{v}
+
r\mathbf{u}
+
\bigl(h_0+Z(s)\bigr)\mathbf{e}_z.$$

This surface is a generalized cylinder obtained by extruding the
transformed profile in the direction $\mathbf{u}$. One principal
curvature is therefore the curvature of the tsunami profile,
$$\kappa_{\mathrm{profile}}(s),$$ while the second principal curvature
is zero: $$\kappa_1=\kappa_{\mathrm{profile}},
\qquad
\kappa_2=0.$$

Consequently, normal layers are compressed or expanded only in the
profile direction. Their scale in the transverse horizontal direction
remains unchanged: $$\sigma_1=1-q\kappa_{\mathrm{profile}},
\qquad
\sigma_2=1.$$ This makes the directional extension comparatively easy to
analyse and permits relatively tall objects whenever the profile
curvature remains small.

### Radial extension {#sec:radial_extension}

In the radial extension, the one-dimensional profile is rotated around
the vertical axis through the observer. Let $$\rho=\sqrt{x^2+y^2},
\qquad
\varphi=\operatorname{atan2}(y,x),$$ and let
$$\bigl(R(\rho),Z(\rho)\bigr)$$ be the transformed one-dimensional
profile. The zero plane is mapped to the surface of revolution
$$\mathbf{S}_{\mathrm{rad}}(\rho,\varphi)
=
\left(
R(\rho)\cos\varphi,\,
R(\rho)\sin\varphi,\,
h_0+Z(\rho)
\right).$$

Unlike the directional surface, the radial surface generally has two
non-zero principal curvatures. The meridional curvature is determined by
the bending of the one-dimensional profile. For an arbitrary profile
parameter $t$, it is $$\kappa_{\mathrm{mer}}
=
\frac{
R'(t)Z''(t)-Z'(t)R''(t)
}{
\left(R'(t)^2+Z'(t)^2\right)^{3/2}
}.$$

The second, azimuthal curvature is introduced by rotating the profile
around the vertical axis: $$\kappa_{\mathrm{azi}}
=
\frac{
Z'(t)
}{
R(t)\sqrt{R'(t)^2+Z'(t)^2}
},$$ up to the chosen orientation of the surface normal.

If the profile is parametrized by arc length $s$, these expressions
simplify to $$\kappa_{\mathrm{mer}}
=
R'(s)Z''(s)-Z'(s)R''(s)$$ and $$\kappa_{\mathrm{azi}}
=
\frac{Z'(s)}{R(s)}.$$

The radial extension can therefore compress objects in both horizontal
principal directions. Its admissible world height may be constrained not
only by the curvature of the original tsunami profile, but also by the
azimuthal curvature introduced by the rotational extension. This is an
important distinction between the directional and radial variants.

Near the axis of revolution, the expression for $\kappa_{\mathrm{azi}}$
must be evaluated by its limit. For a smooth surface meeting the axis
regularly, the meridional and azimuthal curvatures coincide at the
centre.

### Height transformation models

The rigid-height model preserves normal distances:
$$g_{\mathrm{rigid}}(x,y,q)=q.$$ Its main advantage is its clear
geometric interpretation. Object heights are preserved, and objects
remain normal to the transformed zero plane. Its disadvantage is that
the transformation may become singular when the world height approaches
a local curvature radius.

A simple alternative is the globally compressed model,
$$g_{\mathrm{global}}(x,y,q)=c q,
\qquad
0<c\leq1.$$ A sufficiently small value of $c$ reduces the normal range
and can prevent intersections of neighbouring normal layers. However, it
compresses all objects uniformly, including those in regions where no
compression is necessary.

A more flexible alternative is a curvature-adaptive model. In this case,
the height mapping depends on the local principal curvatures:
$$g_{\mathrm{adaptive}}(x,y,q)
=
\frac{\eta}{K(x,y)}
\tanh\left(
\frac{K(x,y)q}{\eta}
\right),$$ where $$K(x,y)
=
\max\left(
|\kappa_1(x,y)|,
|\kappa_2(x,y)|
\right).$$ For locally flat regions, the limiting value is
$$g_{\mathrm{adaptive}}(x,y,q)=q.$$ For large values of $|q|K$, the
transformed height approaches the safe normal-distance limit $\eta/K$.
Thus, low objects and objects in weakly curved regions are affected only
slightly, whereas tall objects in strongly curved regions are compressed
more substantially.

The adaptive model prevents the transformed points from reaching the
local focal surfaces associated with the principal curvatures. Its
disadvantage is that the vertical scale varies spatially, which may
introduce visible changes in object proportions. The choice between the
rigid, globally compressed, and curvature-adaptive models therefore
depends on whether preservation of object height or preservation of a
globally valid non-intersecting transformation is considered more
important.

### Visualisation of height constraints

<figure id="fig:curvature_band" data-latex-placement="tbp">
<figure id="fig:curvature_band_flat">
<img src="./images/curvature_band_parabolic_500_100_lift_0.png" />
<figcaption>No uplifting (<span
class="math inline"><em>α</em><sub><em>w</em></sub> = 78<sup>∘</sup></span>)</figcaption>
</figure>
<figure id="fig:curvature_band_medium">
<img src="./images/curvature_band_parabolic_500_100_lift_116.png" />
<figcaption>Medium uplifting (<span
class="math inline"><em>α</em><sub><em>w</em></sub> = 116<sup>∘</sup></span>)</figcaption>
</figure>
<figure id="fig:curvature_band_high">
<img src="./images/curvature_band_parabolic_500_100_lift_153.png" />
<figcaption>High uplifting (<span
class="math inline"><em>α</em><sub><em>w</em></sub> = 153<sup>∘</sup></span>)</figcaption>
</figure>
<figcaption>High uplifting (<span
class="math inline"><em>α</em><sub><em>w</em></sub> = 153<sup>∘</sup></span>)</figcaption>
</figure>

Figure [66](#fig:zero_planes){reference-type="ref"
reference="fig:zero_planes"} illustrates the normal-coordinate
construction in a vertical cross-section. The original zero plane, its
uplifted profile, and objects extending above and below the plane are
shown before and after the transformation. The figure demonstrates that
normal distances are preserved in the rigid-height model, while
tangential distances are compressed on one side of the profile and
expanded on the other.

Figure [70](#fig:curvature_band){reference-type="ref"
reference="fig:curvature_band"} visualises the local height constraint
along the uplifted profile. At each point, a band is drawn in the normal
direction with width $$\min\left(
h_w,,
\eta R
\right),$$ where $$R=\frac{1}{|\kappa_{\mathrm{profile}}|}$$ is the
radius of curvature in the side-view plane. Regions in which the full
world height satisfies $$h_w\leq\eta R$$ are shown in green. Regions in
which the band must be reduced because of excessive curvature are shown
in red.

As the degree of uplift increases, the curvature radius decreases,
particularly in strongly bent parts of the profile. The admissible band
therefore becomes narrower. This representation provides an intuitive
indication of where tall objects can be transformed without
intersections and where additional height compression is required.
