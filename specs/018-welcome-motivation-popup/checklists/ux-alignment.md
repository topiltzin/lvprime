# UX Alignment Checklist: Welcome Motivation Popup

**Purpose**: Manual verification of the popup and editor (FR-014 to FR-020). No browser could be launched in the implementation session (missing system libraries), so these are NOT yet verified: run `quickstart.md` and tick each item.
**Feature**: [spec.md](../spec.md)

- [ ] FR-014: heading, coach label, large message text and one prominent "Let's go!" action
- [ ] FR-015: firework burst on open (<= 1.2 s) and shorter burst on close (<= 0.5 s); text readable and dismissible at once
- [ ] FR-016: reduced motion shows a plain fade with no `canvas.welcome-fx` in the DOM
- [ ] FR-017: focus lands on the button, Esc closes, focus returns to the previous element, dialog is announced with its title and message
- [ ] FR-017: text contrast >= 4.5:1 in light and dark
- [ ] FR-018: 360 px wide, no horizontal scroll, 44x44 px close controls reachable with a 300-character message
- [ ] FR-019: existing colors/type; no flashing above 3 per second
- [ ] FR-020: editor has a visible label, counter turns warning at 270, day picker works by touch and arrow keys
- [ ] Particle layer draws above the dialog backdrop (top-layer popover) in Chrome, Firefox and Safari
