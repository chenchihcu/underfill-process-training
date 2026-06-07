# Underfill Smart Dispensing & Quality Control Dashboard
An industrial IoT-style interactive dashboard for managing Loctite UF 3808 semiconductor underfill dispensing processes and quality acceptance.

## Design Tone & Style
- Theme: Premium Dark Mode
- Colors: Deep obsidian (#0D0D11), sleek slate (#1A1A24), neon cyan (#00F2FE) for active dispensing paths, emerald green (#00FF87) for quality pass, warning amber (#FFB300) for alerts, and alert red (#FF3B30) for rejects.
- Typography: Modern sans-serif (Inter, Outfit)
- Layout: 3-Column Responsive Grid Layout

## UI Structure & Component Layout

### Header: System Status Bar
- Left: "Stitch-Underfill-IoT v1.2" logo with a blinking green status dot.
- Center: Active Material Status: "Loctite UF 3808" (Viscosity: 348 cP | Storage: -40°C ~ -15°C | Life: 24h).
- Right: Daily Checklist status progress bar (e.g. "4/5 completed") and a system clock.

### Column 1: Material Spec & Component Selection Matrix (Left)
- **Material Specs (Static Card)**:
  - 3D-effect pill-shaped tag: "Viscosity: 348 cP @ 25°C"
  - Interactive table or cards showing cure temp options: "130°C / 8 mins" or "150°C / 5 mins".
- **Component Selection (Interactive Card)**:
  - Select dropdown for Component Type: BGA, WLCSP, Flip Chip, QFN.
  - Selecting a component automatically populates standard fields:
    - Die Size: (e.g., > 25mm for BGA)
    - Ball Pitch: (e.g., 0.8mm for BGA)
    - Action requirement: "Recommended" / "Mandatory" / "Core"
  - Interactive sliders to dynamically adjust:
    - **Preheat Temp**: default 85°C (range 70°C - 100°C)
    - **Line Speed**: default 15 mm/s (range 5 - 30 mm/s)

### Column 2: Live Dispensing Path Simulator (Center)
- **Path Selection Tabs**: "L-Shape" (Recommended), "I-Shape", "U-Shape".
- **Visual Path Canvas**:
  - A stylized diagram of a silicon die (centered square) and ball array.
  - A glowing cyan dot representing the dispensing needle, tracing the chosen path (e.g., along top and left edge for L-shape).
  - Fluid flow animation showing underfill capillary action creeping under the die.
- **Dynamic Control Sliders**:
  - Needle Height (range: 0.05mm - 0.5mm, optimal: 0.1mm)
  - Dispense Pressure (range: 0.1 MPa - 0.5 MPa)

### Column 3: Quality Acceptance & X-Ray Analysis (Right)
- **Fillet Height Inspector**:
  - Double-slider for Fillet Height ratio (range: 0% - 100%).
  - Real-time status display:
    - If height is between 50% and 75% -> Status badge "PASS" (emerald green).
    - If outside -> Status badge "REJECT" (danger red).
  - Side-by-side illustration previewing a good fillet vs a starved/overflowed fillet.
- **X-Ray Voiding Analyzer**:
  - Interactive slider for Voiding Area Percentage (range: 0% - 50%).
  - Status display:
    - Voids <= 25% -> "PASS (IPC-A-610 Compliant)"
    - Voids > 25% -> "FAIL (Excessive Voiding)"
  - A circle overlay showing mock air bubbles shrinking or growing based on the slider value.

### Bottom: Trouble-Shooting Search & Daily Checklist
- **Interactive Checklist**:
  - Checkboxes for:
    - [ ] Clean nozzle & verify needle offset
    - [ ] Pre-heat substrate to 85°C
    - [ ] Measure UF 3808 temperature (must be room temp, 2 hours defrost)
    - [ ] Conduct X-Ray test on first 5 dummy boards
  - **Ts-Log Finder (Search bar)**:
    - Quick search for troubleshooting. Example: "Incomplete penetration" -> displays "Underheat board. Action: Increase preheat to 85°C".
