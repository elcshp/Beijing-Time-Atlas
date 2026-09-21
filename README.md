# Beijing Time Atlas · 北京出行时间地图

**An interactive cartogram that bends Beijing according to estimated travel time.**

Physical proximity does not imply easy access. A short trip through a congested district may take longer than a geographically distant trip along a fast corridor. Beijing Time Atlas makes that difference visible: it builds a directed transport network, assigns scenario-dependent travel costs, estimates journeys between landmarks, and smoothly deforms the original map to approximate those journey times.

The map supports Chinese and English, phones and computers, weekday/weekend scenarios, half-hour time selection, animated daily playback, landmark exploration, and searchable start–destination routes.

> **Model status:** this is an illustrative, uncalibrated travel-time model—not live traffic or operational navigation. The mathematical expressions below describe the current implementation. Precise equations do not imply that their coefficients have been measured or fitted.

## 1. The central idea

Let $p_i\in\mathbb{R}^2$ be the geographic position of landmark $i$, and let $T_{ij}$ be the estimated time from $i$ to $j$ under a selected transport scenario. We seek displayed positions $z_i$ satisfying, approximately,

```math
\kappa\lVert z_i-z_j\rVert_2\approx\frac{T_{ij}+T_{ji}}{2},
\qquad i\ne j.
```

Here $\kappa=4.5$ minutes per geographic-coordinate kilometre is a **fixed display scale**, not an assumed vehicle speed. It prevents a uniform increase in journey times from disappearing through automatic rescaling.

The essential distinction is:

- **Map construction:** fit the whole matrix of landmark-to-landmark times. There is no selected origin.
- **Route search:** overlay one directed journey from a selected start to a destination. This does not change the matrix or the deformation anchors.

There are currently $N=21$ landmarks, including 人大附中本部 / RDFZ, and

```math
\binom{N}{2}=\frac{21\cdot20}{2}=210
```

unordered landmark pairs. Search covers 4,896 local map-name entries; those additional entries are searchable endpoints, **not additional fitting anchors**.

## 2. Scope, coordinates and notation

The current dataset concentrates on central Beijing inside the Sixth Ring. It does **not** cover every place within the ring. Its approximate geographic data bounds are $116.23^\circ$–$116.55^\circ$ E and $39.82^\circ$–$40.04^\circ$ N.

Coordinates are converted to a local planar approximation:

```math
\mathbf{x}(\lambda,\varphi)=
\begin{bmatrix}
85.32(\lambda-116.39)\\
111.2(\varphi-39.93)
\end{bmatrix}\ \mathrm{km},
```

where longitude $\lambda$ and latitude $\varphi$ are in degrees. The implementation measures edge lengths in this local plane, rather than solving geodesics on an ellipsoid.

| Symbol | Meaning | Units |
|---|---|---|
| $d$ | Weekday or weekend | Category |
| $h$ | Beijing local time, UTC+8 | Hours |
| $m$ | Drive, bus or bike mode | Category |
| $\mathbf{x}_v$ | Network-node position | km |
| $\ell_e$ | Directed edge length | km |
| $v_e^0$ | Baseline road-class speed | km/h |
| $P(\mathbf{x};d,h)$ | Assumed local traffic pressure | Dimensionless |
| $\mu_e(d,h)$ | Road moving-time multiplier | Dimensionless |
| $c_e^{(m)}(d,h)$ | Edge traversal cost | min |
| $T_{ij}$ | Directional journey estimate | min |
| $D_{ij}$ | Symmetrized fitting target | min |
| $F$ | Geographic-to-time-map deformation | km → display-coordinate km |

All journey estimates use **frozen snapshot conditions**: the selected $h$ determines costs for the entire journey.

## 3. Directed transport graphs

Each mode uses an admissible directed graph

```math
G_m=(V_m,E_m).
```

Vertices come from OpenStreetMap road/path nodes. Edges connect consecutive nodes along admissible ways, with length

```math
\ell_{(u,v)}=\lVert\mathbf{x}_v-\mathbf{x}_u\rVert_2.
```

Direction and availability depend on mapped one-way rules, road classes and mode-specific access filters. Driving and the bus-corridor approximation use the road graph; cycling and walking have separate admissible edges. Walking edges are bidirectional in this model.

Endpoints attach to their nearest node in the mode's largest strongly connected component:

```math
\sigma_m(p)=\underset{v\in V_m^{\mathrm{SCC}}}{\arg\min}
\lVert p-\mathbf{x}_v\rVert_2,
\qquad
\delta_m(p)=\lVert p-\mathbf{x}_{\sigma_m(p)}\rVert_2.
```

This avoids snapping into disconnected fragments. The interactive router rejects an endpoint if its connector exceeds $0.7$ km. Connectors are approximate straight segments, costed at walking speed; they are not verified entrances or traversable paths.

The current exports contain:

| Dataset | Size |
|---|---:|
| Directed road edges used for scenario matrices | 271,561 |
| Nodes in the combined interactive routing export | 232,417 |
| Directed edges in that combined export | 521,241 |
| Landmark anchors | 21 |
| Search-name entries | 4,896 |

The road matrix and combined routing export have different counts because the latter also includes walking and cycling edges.

## 4. Spatial and temporal traffic model

### 4.1 Periodic daily pulses

The shortest separation between two times on a 24-hour clock is

```math
\Delta_{24}(h,c)=\min\bigl(|h-c|,\ 24-|h-c|\bigr).
```

A daily activity pulse is

```math
g(h;c,\sigma)=\exp\left[-\frac{\Delta_{24}(h,c)^2}{2\sigma^2}\right].
```

Define morning, evening-commute and broad daytime pulses:

```math
M(h)=g(h;8.2,1.35),\qquad
E(h)=g(h;18,1.8),\qquad
B(h)=g(h;13.5,4.8).
```

The five temporal weights are exactly:

```math
w_{\mathrm{core}}(h)=0.16+0.60B(h)+0.20E(h),
```

```math
w_{\mathrm{commute}}(d,h)=
\begin{cases}
0.95M(h)+1.15E(h)+0.16B(h),&d=\mathrm{weekday},\\
0.12g(h;13,4),&d=\mathrm{weekend},
\end{cases}
```

```math
w_{\mathrm{tourism}}(d,h)=
\begin{cases}
0.55g(h;13.8,3.5)+0.15g(h;19,2),&d=\mathrm{weekday},\\
1.15g(h;13.8,3.5)+0.15g(h;19,2),&d=\mathrm{weekend},
\end{cases}
```

```math
w_{\mathrm{night}}(d,h)=
\begin{cases}
0.75g(h;21.5,2.15),&d=\mathrm{weekday},\\
1.05g(h;21.5,2.15),&d=\mathrm{weekend},
\end{cases}
```

```math
w_{\mathrm{hub}}(h)=0.18+0.35M(h)+0.45E(h)+0.20B(h).
```

These functions encode hypotheses about daily activity. For example, $h=8.2$ means 08:12, but this is a chosen model centre—not a measured Beijing-wide rush-hour maximum.

### 4.2 Spatial activity kernels

Each zone $r$ has a centre $\mathbf{c}_r$, radius parameter $s_r$, strength $\beta_r$, and activity class $k(r)$. Its spatial kernel is

```math
K_r(\mathbf{x})=\beta_r
\exp\left[-\frac{\lVert\mathbf{x}-\mathbf{c}_r\rVert_2^2}{2s_r^2}\right].
```

The total traffic pressure is

```math
\boxed{
P(\mathbf{x};d,h)=0.08w_{\mathrm{core}}(h)
+\sum_r K_r(\mathbf{x})w_{k(r)}(d,h)
}.
```

The current zone parameters are:

| Zone | Class | Longitude | Latitude | $s_r$ (km) | $\beta_r$ |
|---|---|---:|---:|---:|---:|
| Inner-city bottlenecks | Core | 116.3910 | 39.9190 | 3.25 | 0.78 |
| Guomao / CBD | Commute | 116.4620 | 39.9110 | 2.30 | 0.95 |
| Financial Street | Commute | 116.3570 | 39.9170 | 1.80 | 0.65 |
| Zhongguancun | Commute | 116.3165 | 39.9810 | 2.50 | 0.80 |
| Wangjing | Commute | 116.4630 | 39.9975 | 2.00 | 0.55 |
| Tiananmen / Qianmen | Tourism | 116.3975 | 39.9020 | 1.50 | 0.78 |
| Wangfujing | Tourism | 116.4110 | 39.9145 | 1.20 | 0.65 |
| Shichahai | Tourism | 116.3878 | 39.9390 | 1.35 | 0.65 |
| Summer Palace approaches | Tourism | 116.2780 | 39.9920 | 1.50 | 0.95 |
| Temple of Heaven | Tourism | 116.4180 | 39.8837 | 1.40 | 0.65 |
| 798 Art District | Tourism | 116.4947 | 39.9842 | 1.20 | 0.60 |
| Sanlitun | Night | 116.4543 | 39.9355 | 1.60 | 1.10 |
| Houhai | Night | 116.3860 | 39.9400 | 1.15 | 0.60 |
| Beijing West approaches | Hub | 116.3210 | 39.8950 | 1.30 | 0.55 |
| Beijing South approaches | Hub | 116.3786 | 39.8652 | 1.30 | 0.55 |

Gaussian kernels have no hard boundary. The inner-city zone is an approximation, not an exact Second Ring polygon. Its persistent baseline weakens overnight; the model does not assume permanent gridlock.

### 4.3 From pressure to road speed

For edge $e=(u,v)$, evaluate pressure at its midpoint:

```math
\mathbf{x}_e=\frac{\mathbf{x}_u+\mathbf{x}_v}{2}.
```

The moving-time multiplier is

```math
\mu_e(d,h)=1+a_eP(\mathbf{x}_e;d,h),
```

where

```math
a_e=
\begin{cases}
0.80,&\text{motorway or trunk},\\
1.00,&\text{primary or secondary},\\
0.72,&\text{other admissible roads}.
\end{cases}
```

Driving speed becomes

```math
v_e^{\mathrm{car}}(d,h)=\frac{v_e^0}{\mu_e(d,h)}.
```

Because $P\ge0$, $\mu_e\ge1$. The scenario field can slow roads relative to their baseline, but cannot accelerate them beyond that baseline.

The heat overlay uses the reference multiplier $1+P(\mathbf{x};d,h)$, corresponding to $a_e=1$. It is therefore not the exact multiplier of every road class beneath a coloured cell.

## 5. Edge costs and full journey times

### 5.1 Baseline road speeds

| OSM road class | $v_e^0$ (km/h) |
|---|---:|
| Motorway | 65 |
| Trunk | 55 |
| Primary | 38 |
| Secondary | 32 |
| Tertiary | 26 |
| Unclassified | 22 |
| Residential | 18 |
| Living street | 10 |
| Service | 12 |

Link roads inherit their base class but are capped at 25 km/h. These are model coefficients, not verified speed limits or observed speeds.

### 5.2 Driving

The edge cost, in minutes, is

```math
\boxed{
c_e^{\mathrm{car}}(d,h)=
\frac{60\ell_e\mu_e(d,h)}{v_e^0}+0.22\ell_e
}.
```

The second term is a distance-proportional delay allowance. Thus doubling $\mu_e$ doubles the moving-time term, not necessarily the whole edge cost or total journey time.

### 5.3 Bus-corridor approximation

Bus speed and cost are

```math
v_e^{\mathrm{bus}}(d,h)=
\min\left(0.72\frac{v_e^0}{\mu_e(d,h)},38\right),
```

```math
c_e^{\mathrm{bus}}(d,h)=
\frac{60\ell_e}{v_e^{\mathrm{bus}}(d,h)}+1.3\ell_e.
```

This approximates slower movement and stopping delay along roads. It does **not** represent a scheduled bus network, specific bus services or actual boarding stops.

### 5.4 Cycling and walking

For admissible cycling edges,

```math
v_e^{\mathrm{bike}}=
\begin{cases}
12,&\text{OSM path},\\
15,&\text{other admissible cycling edges},
\end{cases}
\qquad
c_e^{\mathrm{bike}}=\frac{60\ell_e}{v_e^{\mathrm{bike}}}+0.22\ell_e.
```

Cycling costs currently do not change with the road-congestion field. Walking costs are

```math
c_e^{\mathrm{walk}}=\frac{60\ell_e}{4.8}=12.5\ell_e.
```

### 5.5 Shortest paths, connectors and overhead

For a directed path $\pi$, define

```math
C_m(\pi;d,h)=\sum_{e\in\pi}c_e^{(m)}(d,h).
```

Dijkstra's algorithm finds a minimum-cost path on the admissible graph:

```math
\pi_m^*(i,j;d,h)\in
\underset{\pi:\sigma_m(p_i)\leadsto\sigma_m(p_j)}{\arg\min}
C_m(\pi;d,h).
```

The complete road-mode estimate is

```math
\boxed{
T_{ij}^{(m)}(d,h)=
C_m(\pi_m^*;d,h)
+12.5\bigl[\delta_m(p_i)+\delta_m(p_j)\bigr]+b_m
},
```

with $b_{\mathrm{car}}=4$, $b_{\mathrm{bus}}=10$, and $b_{\mathrm{bike}}=1$ minute. Matrix diagonals are explicitly set to zero.

A heap-based search has conventional worst-case complexity

```math
O\bigl((|V_m|+|E_m|)\log|V_m|\bigr).
```

These are shortest routes **within the encoded graph and cost assumptions**. Missing turn restrictions, entrance details and other constraints can change the real-world optimum.

## 6. Subway alternatives

### 6.1 Line-specific platform states

A rail state is a pair

```math
s=(\text{line},\text{station}).
```

Separate states prevent a line change at one station from being free. Adjacent station states on a line have cost

```math
c_{ab}^{\mathrm{rail}}=
\frac{60\cdot1.08}{36}\lVert\mathbf{x}_b-\mathbf{x}_a\rVert_2+0.65.
```

The factors represent an assumed 36 km/h running speed, a 1.08 geometric allowance and 0.65 minutes dwell per link. A same-station line transfer costs 5 minutes.

Let $R_{ab}$ be the shortest directed rail-state cost from $a$ to $b$.

### 6.2 Walking access and waiting

Let $A_i(a)$ be walking time from endpoint $i$ to station state $a$, including endpoint and station connectors. Candidate station access is rejected when $A_i(a)>25$ minutes; station connectors longer than $0.7$ km are also rejected.

The additional waiting allowance is

```math
\omega(d,h)=
\begin{cases}
1,&w_{\mathrm{commute}}(d,h)>0.65,\\
3,&w_{\mathrm{commute}}(d,h)\le0.65.
\end{cases}
```

The precomputed landmark rail alternative is

```math
T_{ij}^{\mathrm{rail}}(d,h)=
\min_{a,b}\left[A_i(a)+6+\omega(d,h)+R_{ab}+A_j(b)+2\right],
```

over permitted access/exit states. The constants are three minutes entrance/security, three minutes baseline waiting and two minutes exit: $6+2=8$ minutes before the extra allowance.

The smaller extra allowance during strong commute demand represents assumed more frequent service. **No operator timetable or measured headway function is loaded.** Rail running times are not multiplied by road congestion.

### 6.3 Interactive rail-search detail

The browser router initializes a multi-source rail search with labels

```math
L_a^{(0)}=A_i(a)+6+\omega(d,h).
```

It propagates minimum labels along rail edges, then minimizes

```math
L_b+A_j(b)+2
```

over reachable exit states with permitted walking access. It additionally rejects retained paths containing no interstation rail hop.

This creates a small distinction from the matrix generator, which can admit same-state boarding/exiting. The browser search retains one best label per rail state, rather than an expanded `(state, has-ridden)` graph; its positive-hop filter is therefore not a proof of the global optimum over every possible journey constrained to include rail. The road shortest-path calculation does not have this qualification.

### 6.4 Service window and mode choice

The conservative transit availability switch is

```math
\chi(h)=\begin{cases}1,&6\le h<22,\\0,&\text{otherwise}.\end{cases}
```

For Bus or Bike with subway alternatives enabled and available,

```math
T_{ij}=\min\left(T_{ij}^{(m)},T_{ij}^{\mathrm{rail}}\right).
```

Otherwise the selected road mode is used. Driving always uses $T_{ij}^{\mathrm{car}}$ regardless of the subway switch.

The two alternatives are complete journeys. In bike mode, the rail alternative does not involve bringing the bicycle aboard the train.

Outside the model window, rail alternatives are unavailable and Bus displays geographic context without a journey estimate. This is a modelling boundary, not a claim about actual first trains, last trains or night buses.

## 7. Constructing an origin-independent time map

### 7.1 Directional times and symmetric fitting targets

One-way roads can produce

```math
T_{ij}\ne T_{ji}.
```

Since a Euclidean separation is symmetric, the map uses

```math
D_{ij}=\frac{T_{ij}+T_{ji}}{2},\qquad D_{ii}=0.
```

The selected-pair comparison reports this average and exposes both directions. The route-search ETA instead reports the specific $i\to j$ journey.

The matrix $D$ is best understood as a **dissimilarity matrix**, not necessarily an exact mathematical metric. In particular, taking the elementwise minimum of complete mode alternatives does not guarantee a triangle inequality. For example, two mode-distance triples $(d_{AB},d_{BC},d_{AC})=(1,9,10)$ and $(9,1,10)$ each satisfy it, while their minimum $(1,1,10)$ does not.

Consequently, exact planar preservation is not generally possible, even before geometric distortion is introduced.

### 7.2 Stress objective and initialization

The embedding seeks centred coordinates $y_i\in\mathbb{R}^2$, measured in minute-coordinate units, that approximately minimize

```math
\mathcal{S}(Y)=\sum_{i<j}
\left(\lVert y_i-y_j\rVert_2-D_{ij}\right)^2.
```

Let $\bar p=N^{-1}\sum_i p_i$ and $r_i=p_i-\bar p$. Initialize with

```math
y_i^{(0)}=\alpha r_i,
\qquad
\alpha=\frac{\sum_{i<j}D_{ij}}
{\sum_{i<j}\lVert r_i-r_j\rVert_2}.
```

Starting from the geographic configuration helps retain a recognizable orientation.

### 7.3 Implemented iteration

For 350 iterations, the implementation applies the complete-graph stress-majorization update

```math
\boxed{
y_i^{(k+1)}=
\frac{1}{N}\sum_{j\ne i}
\frac{D_{ij}}{\max\left(10^{-6},\lVert y_i^{(k)}-y_j^{(k)}\rVert_2\right)}
\left(y_i^{(k)}-y_j^{(k)}\right)
}.
```

Pairwise antisymmetry keeps the updated configuration centred. The small denominator floor prevents division by zero. The implementation uses a fixed iteration count, not a convergence tolerance, and does not certify a global minimum of this nonconvex objective.

After iteration, a rotation aligns the result with geography:

```math
\theta=\operatorname{atan2}
\left(
\sum_i(y_{ix}r_{iy}-y_{iy}r_{ix}),
\sum_i(y_{ix}r_{ix}+y_{iy}r_{iy})
\right),
\qquad
\widetilde y_i=R(\theta)y_i.
```

The target anchor positions in map-coordinate units are

```math
q_i=\bar p+\frac{\widetilde y_i}{\kappa},
\qquad \kappa=4.5\ \mathrm{min/km}.
```

Rotation does not change pairwise distances; the fixed $\kappa$ preserves the visual significance of broad increases in travel times across scenarios.

## 8. Bending the original map with a thin-plate spline

Moving icons alone would discard the structure of the city. Instead, one smooth displacement field transforms roads, parks, water, labels, grid lines, route geometry and landmark positions.

### 8.1 Normalized control points and kernel

Define

```math
u_i=\frac{p_i-\bar p}{10},\qquad
u(x)=\frac{x-\bar p}{10}.
```

The implemented radial kernel is

```math
U(s)=
\begin{cases}
s\log s,&s>10^{-12},\\
0,&s\le10^{-12},
\end{cases}
\qquad s=\lVert u-u_i\rVert_2^2.
```

Here the argument is **squared radius**: $U(r^2)=2r^2\log r$ for $r>0$. This records the code's exact convention rather than silently substituting another thin-plate-spline normalization.

The displacement takes the form

```math
f(x)=a_0+a_xu_x(x)+a_yu_y(x)
+\sum_{i=1}^{N}w_iU\left(\lVert u(x)-u_i\rVert_2^2\right),
```

where $a_0,a_x,a_y,w_i\in\mathbb{R}^2$.

### 8.2 Regularized interpolation system

Set

```math
K_{ij}=U\left(\lVert u_i-u_j\rVert_2^2\right),
\qquad
P_i=\begin{bmatrix}1&u_{ix}&u_{iy}\end{bmatrix},
\qquad
\Delta_i=q_i-p_i.
```

For the two displacement coordinates, solve

```math
\begin{bmatrix}
K+\lambda I&P\\
P^\mathsf{T}&0
\end{bmatrix}
\begin{bmatrix}
W\\A
\end{bmatrix}
=
\begin{bmatrix}
\Delta\\0
\end{bmatrix},
\qquad\lambda=0.001.
```

The lower block imposes the affine side conditions $P^\mathsf{T}W=0$. Regularization means that the final displacement need not interpolate each desired anchor exactly.

### 8.3 Moderating local folds

The final deformation is

```math
F_\eta(x)=x+\eta f(x),\qquad 0<\eta\le1.
```

Its Jacobian is

```math
J_\eta(x)=I+\eta\nabla f(x).
```

Derivatives are approximated by forward differences with $\varepsilon=0.002$ km. On a grid spaced by 0.6 km over $[-15,15]\times[-13,14]$, the code evaluates

```math
J_{\min}(\eta)=
\min_{x\in\mathcal{G},\ s\in\{0.25,0.5,0.75,1\}}
\det\left[I+s\eta\nabla f(x)\right].
```

Starting with $\eta=1$, it repeatedly sets $\eta\leftarrow0.9\eta$ while $J_{\min}<0.08$ and $\eta>0.1$.

This is a **sampled fold-moderation heuristic**. The stopping floor can be reached before the threshold is met, unsampled locations are not certified, and the check does not prove global injectivity or fold-free transitions between two independently warped scenarios.

The displayed anchor is $z_i=F_\eta(p_i)$, which can differ from the ideal embedding target $q_i$.

### 8.4 Reported layout mismatch

The UI reports the relative absolute pair-distance error of the **final moderated map**:

```math
\boxed{
\mathrm{mismatch}(\%)=
100\frac{
\sum_{i<j}\left|\kappa\lVert F_\eta(p_i)-F_\eta(p_j)\rVert_2-D_{ij}\right|
}{\sum_{i<j}D_{ij}}
}.
```

This is not the squared stress minimized by the embedding, an ETA error against observations, or a confidence interval. A low mismatch means only that the displayed separations approximate the model's own pair-time targets well.

## 9. Continuous visual evolution

Let $F_0$ be the currently displayed mapping and $F_1$ the next target mapping. For normalized animation progress $u\in[0,1]$,

```math
F_u(x)=\left[1-e(u)\right]F_0(x)+e(u)F_1(x).
```

Outside daily playback, manual view/scenario transitions use smoothstep,

```math
e(u)=3u^2-2u^3,
```

while transitions initiated during daily playback use $e(u)=u$, with nominal 1.8-second half-hour transitions. Manual scenario changes last 1.05 seconds; geography/time conversion lasts 1.2 seconds. Reduced-motion preferences skip geometric interpolation.

These frames are **visual interpolation**, not newly routed intermediate-time snapshots. The model has 48 half-hour slots per day type:

```math
2\times48=96\ \text{scenarios},
\qquad
96\times2=192\ \text{precomputed Drive/Bus matrices}.
```

Cycling uses one fixed matrix. Camera zoom and pan remain unchanged during playback unless the user explicitly fits or moves the view. Browser workload can affect actual animation timing.

The route result panel keeps a fixed, scrollable height during updates and transit unavailability. While a replacement is calculated, the previous route is dimmed and retains its own timestamp. New route geometry crossfades over 450 ms. This avoids collapsing the panel and moving the map up and down on every update.

## 10. Route geometry and search behaviour

Road routes are reconstructed from predecessor pointers returned by the shortest-path search. Their map geometry is transformed pointwise by the same $F_u$ used for the basemap:

```math
\gamma_{\mathrm{display}}(s,u)=F_u\left(\gamma_{\mathrm{geographic}}(s)\right).
```

The chosen route is computed in the **network**, not by drawing a straight line through the deformed picture. Warping a route does not change its calculated ETA.

Rail links are station-to-station schematic segments; their displayed polyline length is not measured track length. Walking legs follow the exported walking network, with approximate endpoint/station connectors.

Search matches local names, bilingual labels and selected aliases. A street-name result represents a point on that named street, not an arbitrary house number. Unlisted addresses are unsupported. Search text and route endpoints are not sent to a third-party geocoding or routing API.

## 11. Implementation layout

| File | Responsibility |
|---|---|
| `dist/index.html` | Bilingual controls, route form and map surface |
| `dist/style.css` | Desktop/mobile layout and stable result panel |
| `dist/app.js` | Rendering, clock, interaction and shared animation |
| `dist/i18n.js` | English and Chinese interface text |
| `dist/traffic-field.js` | Temporal weights and spatial traffic kernels |
| `dist/model.js` | Mode combination, symmetrization and embedding |
| `dist/warp.js` | Regularized spline and fold moderation |
| `dist/route-ui.js` | Search, route-result lifecycle and overlay |
| `dist/route-worker.js` | Browser-worker shortest-path calculations |
| `dist/data.json` | Landmarks, base geometry, cycling and rail data |
| `dist/traffic.json` | 192 precomputed road-mode matrices |
| `dist/search-places.json` | Local search-name catalog |
| `dist/routes-graph.json.gz` | Compressed graph, loaded on first route request |
| `prepare_data.py` | Base-network and landmark matrix preparation |
| `prepare_traffic.py` | Scenario-specific road matrix generation |
| `prepare_routes.py` | Interactive routing graph and search export |

The site is static HTML/CSS/JavaScript. It needs no Amap account, application backend or routing API key. Interactive graph search runs in a Web Worker; graph decompression requires browser support for `DecompressionStream`.

The preparation scripts require Python, NumPy, SciPy, Node.js and the original OSM downloads. Their raw-input paths currently refer to the development workspace and must be changed when rebuilding elsewhere. The delivered static data can be used without running those scripts. Re-running the base generator directly over `data.json` can replace enriched geometry; generate to a separate output and deliberately merge the intended fields.

## 12. Running the static app

For the complete source layout, serve `dist` over HTTP, for example:

```bash
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000` in a browser. Avoid opening `index.html` directly via `file://`, because the app loads data and a worker through browser requests.

For a static hosting upload, keep **all contents of `dist` together**, including the compressed routing graph. If those contents are placed at the repository root, the hosting root is that directory; the runtime uses relative asset paths. This README can sit alongside `index.html` in such a deployment, although the source-path table above describes the full development layout.

## 13. Interpretation and limitations

The map answers: **“How would this assumed transport-cost scenario reshape relative accessibility?”** It does not establish observed travel-time accuracy.

Current limitations include:

- Uncalibrated spatial strengths, temporal pulses, road speeds and delay allowances.
- No live congestion, incidents, road closures, weather, holidays or demand feedback.
- Frozen snapshot routing, not departure-time propagation through changing conditions.
- No actual bus service network or operator transit timetable.
- Incomplete turn/access restrictions and approximate last-mile connectors.
- A local planar projection and incomplete coverage inside the Sixth Ring.
- Only 21 deformation anchors, despite the larger searchable catalog.
- Non-Euclidean and potentially non-metric fitting targets, plus spline/fold-moderation distortion.
- Schematic rail geometry and the rail-label filtering limitation described above.

The physical map, estimated route and time cartogram are related representations with different meanings. A bent road is not a changed physical road; a compact screen separation is not necessarily a short geographic distance.

## 14. Validation and provenance

Development checks have compared selected interactive Drive/Bus/Bike route estimates against their corresponding matrix entries, verified subway alternatives and driving's exclusion of rail, checked service-window handling, and exercised search, swapping, clearing, stale-response rejection and origin-independent map selection.

DOM/canvas simulations have checked multiple viewport widths, touch gesture logic, bilingual labels, animation and stable result-panel state. These checks do not constitute real-device browser testing or empirical validation of the traffic assumptions.

Base geometry and network data originate from the project's September 2026 OpenStreetMap snapshot. Attribution: **© OpenStreetMap contributors**. Preserve the project's existing OpenStreetMap attribution and applicable ODbL data notices when redistributing. A software-code licence is a separate choice; this README does not assign one.

The equations and coefficients in this README are documented from the current project source, particularly `traffic-field.js`, `model.js`, `warp.js`, `route-worker.js` and the preparation scripts. Future calibration should be evaluated against independent observed journey times; improving cartogram mismatch alone cannot validate the underlying travel-time model.
