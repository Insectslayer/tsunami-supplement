# Tsunami Calculations

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
Figure [1](#fig:notation){reference-type="ref"
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

@@figure:notation@@

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

@@figure:profiles@@

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

@@figure:angular-construction@@

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

@@figure:coverage@@

@@figure:distance-change@@

@@figure:evolution@@

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

@@figure:extensions-2d@@

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

@@figure:comparison@@

## Three-dimensional tsunami extension {#sec:3d_extension}

The one-dimensional transformations introduced in
Section [10.1](#sec:1d_tsunami){reference-type="ref"
reference="sec:1d_tsunami"} describe the deformation of the ground in a
vertical plane. To apply the tsunami transformation to a
three-dimensional scene, we first extend the transformed profile to a
two-dimensional reference surface and then define the positions of
points above and below this surface using normal coordinates.

@@figure:zero-plane@@

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

@@figure:curvature-band@@

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
