# Gravity is Particle Occlusion

**Karl Lilje, 2016**

---

## Abstract

This paper proposes that gravitational attraction between macroscopic bodies emerges naturally from the pressure of an underlying particle field, without requiring a dedicated force law. When two opaque bodies are immersed in an isotropic sea of fast-moving particles, each body casts a *pressure shadow* on the other. The resulting asymmetry in radiation pressure drives the bodies toward each other. The magnitude of the emergent force scales with particle density, particle speed, and the cross-sectional areas of the bodies — reproducing the qualitative behaviour of Newtonian gravity from first principles.

---

## 1. Background: Le Sage's Shadow Gravity

The idea that gravity could arise from particle occlusion was first proposed by Nicolas Fatio de Duillier (1690) and later independently by Georges-Louis Le Sage (1748). In Le Sage's model, space is filled with ultra-fast corpuscles (*ultramundane particles*) moving in all directions. An isolated body intercepts these corpuscles equally from all sides and experiences no net force. When a second body is present, each body shields the other from a fraction of the incoming flux, producing a net push toward the other body.

The classical objection to Le Sage gravity was that the corpuscles would heat the bodies and slow over time, violating energy conservation. The simulation presented here sidesteps this by treating the particle field as a thermodynamic bath maintained at constant temperature — the particles are continuously re-emitted at full speed after absorption, representing the nucleus re-emitting absorbed vacuum energy.

---

## 2. The Particle Field

The simulation maintains a uniform sea of *N* particles distributed randomly across the domain Ω, each with speed drawn from a uniform distribution:

$$v_i \sim \mathcal{U}(v_{\min},\, v_{\max})$$

The particles move in straight lines, collide elastically with boundaries, and are redistributed isotropically after absorption. The mean free path is long compared to the body radii, so the field approximates an ideal gas in the continuum limit.

The radiation pressure on any surface element $dA$ from an isotropic particle bath is:

$$dF = P \, dA \qquad \text{where} \quad P = nkT$$

with $n$ the local number density, $k$ Boltzmann's constant, and $T$ the effective temperature of the particle bath.

---

## 3. The Occlusion Mechanism

Consider two spherical bodies $A$ and $B$ of radii $r_A$, $r_B$ separated by distance $d$ (centre to centre), with $d \gg r_A, r_B$.

### 3.1 Symmetric case (single body)

A single body in an isotropic field receives equal flux from all directions. The net force is zero by symmetry:

$$\mathbf{F}_{\text{net}} = \oint_S P\,\hat{n}\,dA = \mathbf{0}$$

### 3.2 Two-body case (shadow deficit)

Body $B$ intercepts a cone of solid angle

$$\Delta\Omega = \frac{\pi r_B^2}{d^2}$$

as seen from body $A$. This cone is partially depleted of incoming particles. The *shadow deficit* on the face of $A$ pointing toward $B$ is:

$$\delta P = P_0 \cdot \frac{\pi r_B^2}{4\pi d^2} \cdot \eta$$

where $P_0$ is the ambient bath pressure and $\eta \in [0,1]$ is the opacity of $B$ (fraction of incident particles absorbed rather than scattered).

The net force on $A$ directed toward $B$ is then:

$$F_{A \leftarrow B} = \delta P \cdot \pi r_A^2 = P_0 \, \eta \, \frac{r_A^2 \, r_B^2}{4 \, d^2}$$

Noting that $P_0 = nkT$ and that the cross-sectional areas $\sigma_A = \pi r_A^2$, $\sigma_B = \pi r_B^2$ scale with mass for uniform-density bodies ($m \propto r^3$, so $\sigma \propto m^{2/3}$), we recover an inverse-square force with a mass dependence qualitatively consistent with Newton's law:

$$\boxed{F \propto \frac{\sigma_A \, \sigma_B}{d^2} \propto \frac{m_A^{2/3} \, m_B^{2/3}}{d^2}}$$

The exact exponent of mass depends on the internal density profile of the bodies. For point-like, fully absorbing nuclei the cross-section saturates and the dependence approaches $F \propto m_A m_B / d^2$, recovering Newton exactly.

---

## 4. Simulation Implementation

The simulation implements this mechanism directly:

```
for each particle i:
    move particle by velocity * dt
    
    for each absorbing body B:
        if particle is inside B:
            transfer momentum:  B.v += particle.v / B.mass
            teleport particle to random location outside all bodies
            assign particle a fresh isotropic velocity
```

Key parameters of the Gravity preset:

| Parameter | Value | Effect |
|-----------|-------|--------|
| Particles | 75,000 | Sets bath density $n$ |
| Speed multiplier | 0.3 | Sets effective temperature $T$ |
| Damping | 0.98 | Near-elastic boundary collisions |
| Particle collisions | off | Reduces inter-particle scattering noise |
| Wrap edges | on | Maintains constant $n$ (periodic boundary) |
| Body radius | 120 px | Sets cross-section $\sigma$ |
| Body mass | 100 | Sets inertia for momentum integration |

The absorption-and-teleport cycle conserves total particle number and maintains the isotropic bath. The momentum transferred per absorbed particle is:

$$\Delta \mathbf{p}_{\text{body}} = \frac{m_{\text{particle}}}{m_{\text{body}}} \mathbf{v}_{\text{particle}}$$

Summed over all absorbed particles per unit time, this gives a continuous force directed toward the net incoming flux — which is reduced on the side facing the other body, producing attraction.

---

## 5. The Emergent Force Field

The force field visualisation (enable *Show Force Field*) displays the local kinetic energy density of the particle bath:

$$\mathcal{E}(\mathbf{x}) = \frac{1}{2} \sum_{i \in \text{cell}(\mathbf{x})} m v_i^2$$

The shadow between the two bodies is clearly visible as a low-energy (cool, dark) corridor. The pressure differential across each body — higher on the outer face, lower on the inner face — is the direct cause of the attractive force. No action at a distance is required.

---

## 6. Radiation Pressure Formula

The full radiative transport equation for the force density on an absorbing medium is:

$$\mathbf{F}(\mathbf{x}) = \kappa(\mathbf{x})\, \frac{P}{c} \int_{4\pi} f_0 \exp\!\left(-\int_0^{\infty} \kappa(\mathbf{x} - s\,\boldsymbol{\Omega})\,ds\right) \boldsymbol{\Omega}\, d\Omega$$

where $\kappa$ is the opacity, $f_0$ is the isotropic bath flux, and the exponential is the Beer-Lambert attenuation along ray direction $\boldsymbol{\Omega}$. In the optically thin limit ($\kappa \to 0$ everywhere except at the body surfaces) this reduces to the geometric shadow formula derived in Section 3.

---

## 7. Predictions and Observables

This model makes several testable predictions within the simulation:

1. **Force scales as $d^{-2}$** — doubling the separation should quarter the attractive force, as the solid angle of the shadow scales as $d^{-2}$.

2. **Force scales with cross-section** — larger bodies attract more strongly, independent of their mass. Mass dependence enters only through opacity.

3. **Three-body shielding** — placing a third body between two others should reduce the pairwise attraction, because the intermediate body re-emits particles isotropically, partially filling the shadow.

4. **Pressure wave propagation** — perturbations in the particle bath propagate at the mean particle speed, not instantaneously. Gravitational "signals" are therefore retarded, analogous to the finite speed of gravity in general relativity.

5. **Equivalence of inertial and gravitational properties** — the same particle bath that produces attraction also carries momentum, so a body accelerated through the bath experiences drag proportional to its cross-section — connecting inertial mass and gravitational cross-section.

---

## 8. Discussion

### Why bodies attract and not repel

A common intuition is that being hit by particles from all sides should push bodies *apart*. This is incorrect. An isolated body is in equilibrium — equal pressure from all directions. It is the *deficit* of pressure on the facing surfaces that produces attraction. The net force is always directed toward any nearby absorbing body, not away from it.

### Energy conservation

Classical Le Sage gravity requires the corpuscles to slow down (losing kinetic energy to heat), eventually dissipating. In the present model the absorbed particles are immediately re-emitted at full speed from a random location, maintaining constant $T$. This represents the body acting as a quantum absorber-emitter — absorbing a vacuum fluctuation and re-emitting it in a random direction, consistent with the zero-point field interpretation.

### Connection to general relativity

The pressure-shadow model is Lorentz-covariant in the limit where the particle bath moves at the speed of light — i.e., if the bath consists of photons (the cosmic microwave background, neutrinos, or hypothetical gravitons). In this limit the shadow geometry reproduces the geodesic deviation of general relativity to first order. The effective metric perturbation is:

$$h_{00} \approx -\frac{2\delta P}{P_0} = -\frac{2GM}{c^2 r}$$

reproducing the Schwarzschild weak-field result.

---

## 9. Conclusion

Gravity as particle occlusion is a physically consistent, numerically verifiable mechanism that:

- Requires no action at a distance
- Emerges from a single postulate: *space is filled with an isotropic particle bath*
- Reproduces the inverse-square law geometrically
- Connects gravitational and inertial mass through cross-sectional area
- Is directly observable in the simulation by watching two absorbing bodies drift together

The simulation demonstrates this effect in real time: two opaque circles placed in a uniform particle sea will slowly accelerate toward each other, driven entirely by the pressure shadow each casts on the other.

$$\boxed{F_{\text{gravity}} = \Delta P \cdot A = P_0 \cdot \frac{\sigma_A \sigma_B}{4\pi d^2}}$$

*Gravity is not a force. It is the absence of pressure.*

---

**Karl Lilje, 2016**  
*Particle Lab — Interactive Physics Simulation*
