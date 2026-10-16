import { html, nothing, type ReactiveController, type ReactiveControllerHost } from 'lit'

/*
 * Material Symbols draws a name it knows as one ligature glyph one em wide, in any letter
 * case ('home', 'Home', 'HOME'). Other text keeps one glyph per character, and in this font
 * every character is one em wide as well. So a value is an icon name exactly when the font
 * measures it one em wide and narrower than its characters measured one at a time. Asking the
 * font Studio loads means no list of names can go stale.
 */
const ICON_FONT = 'Material Symbols Outlined'
const EM = 100
// Every Material Symbols name is 2 to 43 letters, digits and underscores.
const CANDIDATE = /^\w{2,64}$/
// Bound values can be anything, so the verdicts are capped.
const MAX_VERDICTS = 1000

const verdicts = new Map<string, boolean>()
let fontLoaded = false
let context: CanvasRenderingContext2D | null | undefined

function iconFontLoaded(): boolean {
    if (!fontLoaded) {
        document.fonts?.forEach((face) => {
            if (face.status === 'loaded' && face.family.replace(/["']/g, '') === ICON_FONT) fontLoaded = true
        })
    }
    return fontLoaded
}

function drawsIcon(name: string): boolean {
    let verdict = verdicts.get(name)
    if (verdict === undefined) {
        context ??= document.createElement('canvas').getContext('2d')
        // Without a 2D canvas there is nothing to measure with; keep the name, as before.
        if (!context) return true
        context.font = `${EM}px '${ICON_FONT}'`
        const width = context.measureText(name).width
        let letters = 0
        for (const char of name) letters += context.measureText(char).width
        verdict = Math.abs(width - EM) < 0.5 && letters - width > EM / 2
        if (verdicts.size >= MAX_VERDICTS) verdicts.clear()
        verdicts.set(name, verdict)
    }
    return verdict
}

/**
 * Decides which configured icon names a host draws. `name()` gives '' for a value that is not
 * an icon name, and for every value until the icon font has loaded; the host renders `probe()`
 * after its icons, and renders again once the font is there.
 */
export class IconNames implements ReactiveController {
    private waiting = false

    constructor(private host: ReactiveControllerHost) {
        host.addController(this)
    }

    hostConnected() {
        document.fonts?.addEventListener('loadingdone', this.fontsLoaded)
        this.fontsLoaded()
    }

    hostDisconnected() {
        document.fonts?.removeEventListener('loadingdone', this.fontsLoaded)
    }

    private fontsLoaded = () => {
        if (this.waiting && iconFontLoaded()) {
            this.waiting = false
            this.host.requestUpdate()
        }
    }

    /** The trimmed value when the icon font draws it as an icon, else ''. */
    name(value: unknown): string {
        if (typeof value !== 'string') return ''
        const name = value.trim()
        if (!CANDIDATE.test(name)) return ''
        if (!iconFontLoaded()) {
            this.waiting = true
            return ''
        }
        return drawsIcon(name) ? name : ''
    }

    /**
     * A hidden word in the icon font while a name waits for it. Laying it out makes the browser
     * load the font, also when its stylesheet arrives after this render (Studio swaps it in from
     * a preload) and nothing else on the page uses it yet.
     */
    probe() {
        return this.waiting
            ? html`<span
                  aria-hidden="true"
                  style="position: absolute; width: 0; height: 0; overflow: hidden; visibility: hidden;
                  font-family: 'Material Symbols Outlined';"
                  >home</span
              >`
            : nothing
    }
}
