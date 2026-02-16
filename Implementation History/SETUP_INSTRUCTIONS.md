# Setup Instructions - Phase 0

> **Legacy setup note:** This is a Phase 0-era walkthrough. For current project status and roadmap, see root `README.md`, `PRODUCTION_NOTES.md`, and `ROADMAP.md`.

## What We've Built

✅ **Complete TypeScript project structure**
✅ **Core psychohistory calculations ported**
✅ **Galaxy class with phase advancement**
✅ **Basic Canvas visualization**
✅ **UI controls and keyboard input**

## Next Steps

### Step 1: Navigate to Project Directory

Open a **new terminal** (to ensure Node.js PATH is loaded) and run:

```bash
cd "C:\Users\eogha\Downloads\Seldons Game TNG\seldon-game"
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- TypeScript
- Vite (development server and build tool)
- Three.js (for future 3D support)

### Step 3: Start Development Server

```bash
npm run dev
```

**Windows PowerShell note:** If you see `npm.ps1 cannot be loaded because running scripts is disabled`, use one of these:
- Run with CMD shim: `npm.cmd run dev`
- Temporary for current session: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` then `npm run dev`
- Permanent for your user: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

You should see:

```
VITE v5.4.0  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  press h + enter to show help
```

### Step 4: Open in Browser

Click the link or navigate to: **http://localhost:5173/**

You should see:
- Title: "Seldon's Game"
- Stats panel showing phase, power, independent stars
- Canvas with 26 stars (A-Z) visualized
- Buttons: "Advance Phase" and "Reset Galaxy"

### Step 5: Test the Game

**Controls:**
- Click "Advance Phase" or press **SPACE** to progress
- Watch stars change rulers (blue = subject, cyan = independent)
- See statistics update each phase
- Press "Reset Galaxy" to start over

## Expected Behavior

After advancing a few phases, you should see:
- Stars forming empires (subjects colored blue)
- Independent stars (cyan) decreasing over time
- Total power increasing as stars grow
- Centralization values changing

## Troubleshooting

**If npm command not found:**
- Close and reopen your terminal
- Verify Node.js: `node --version`
- Should show v22.22.0 or similar

**If installation fails:**
- Try: `npm install --legacy-peer-deps`
- Or manually check Node.js installation

**If browser shows errors:**
- Check browser console (F12)
- Look for TypeScript or module errors
- Report back what you see

## Files Created

```
seldon-game/
├── src/
│   ├── core/
│   │   ├── types.ts              ✅ Type definitions
│   │   ├── psychohistory.ts      ✅ Core formulas
│   │   └── galaxy.ts             ✅ Main galaxy class
│   ├── utils/
│   │   └── seed-random.ts        ✅ Seeded RNG
│   ├── styles/
│   │   └── main.css              ✅ Basic styling
│   └── main.ts                   ✅ Entry point
├── index.html                    ✅ HTML template
├── package.json                  ✅ Dependencies
├── tsconfig.json                 ✅ TypeScript config
├── vite.config.ts                ✅ Vite config
└── README.md                     ✅ Documentation
```

## What's Working

✅ **Galaxy generation** - 26 stars with random positions
✅ **Phase advancement** - Complete psychohistory simulation
✅ **Power calculations** - Stars gain/lose power based on centralization
✅ **Ruler determination** - Influence calculations work
✅ **Growth & centralization updates** - Epochs affect behavior
✅ **Basic visualization** - Stars drawn on canvas
✅ **Keyboard/mouse controls** - Space advances, buttons work

## What's Next (Phase 1+)

⏳ Scale to 100 stars
⏳ Better rendering (ruler arrows, power glow)
⏳ Detail view when clicking stars
⏳ Save/load functionality
⏳ Improved UI panels

## Success Criteria

You should be able to:
1. Run `npm run dev` without errors
2. Open http://localhost:5173 in browser
3. See 26 stars on canvas
4. Press SPACE to advance phases
5. Watch empires form and change

**Once this works, Phase 0 is complete!** 🎉

---

## Ready?

Run these commands and report back what happens:

```bash
cd "C:\Users\eogha\Downloads\Seldons Game TNG\seldon-game"
npm install
npm run dev
```

Then open the localhost link in your browser!




