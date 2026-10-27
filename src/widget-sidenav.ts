import { html, css, LitElement, PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { SideNavigationConfiguration } from './definition-schema'
import { IconNames } from './icon-names'

import '@material/web/icon/icon.js'

type Theme = {
    theme_name: string
    theme_object: any
}

@customElement('widget-sidenav-versionplaceholder')
export class WidgetSidenav extends LitElement {
    @property({ type: Object }) inputData?: SideNavigationConfiguration
    @property({ type: Object }) theme?: Theme
    @property({ type: String }) route?: string

    @state() private themeTitleColor?: string

    private icons = new IconNames(this)

    version: string = 'versionplaceholder'

    update(changedProperties: Map<string, any>) {
        if (changedProperties.has('theme')) {
            this.registerTheme(this.theme)
        }

        super.update(changedProperties)
    }

    protected firstUpdated(_changedProperties: PropertyValues): void {
        this.registerTheme(this.theme)
    }

    registerTheme(theme?: Theme) {
        this.themeTitleColor = `var(--re-text-color, ${theme?.theme_object?.title?.textStyle?.color || 'inherit'})`
    }

    handleNavItemClick(route?: string) {
        // console.log('Navigating to:', item.route)
        const event = new CustomEvent('nav-submit', {
            detail: { path: String(route) },
            bubbles: true,
            composed: true
        })
        this.dispatchEvent(event)
    }

    trimRoute(route?: string) {
        route = String(route)
        if (!route) return ''
        return '/' + route.split('/').filter(Boolean).join('/')
    }

    resolveRoute(item?: any): string | undefined {
        let route = String(item?.route ?? '')
        if (item?.variables) {
            for (const variable of item.variables) {
                if (variable.label) {
                    route = route
                        .split(`{{${variable.label}}}`)
                        .join(encodeURIComponent(String(variable.value ?? '')))
                }
            }
        }
        if (route.includes('*')) {
            const currentSegments = (this.route || '').split('/').filter(Boolean)
            const routeSegments = route.split('/').filter(Boolean)
            for (let i = 0; i < routeSegments.length; i++) {
                if (routeSegments[i] === '*') {
                    routeSegments[i] = currentSegments[i] ?? ''
                }
            }
            route = (route.startsWith('/') ? '/' : '') + routeSegments.filter(Boolean).join('/')
        }
        return route
    }

    matchesRoute(itemRoute?: string) {
        if (itemRoute === undefined) return false
        itemRoute = String(itemRoute)
        const route = this.trimRoute(decodeURIComponent(this.route || '/'))
        const subRoute = this.trimRoute(itemRoute)
        if (itemRoute.startsWith('/')) {
            return route.startsWith(subRoute)
        } else {
            return route.endsWith(subRoute) || route === subRoute
        }
    }

    static styles = css`
        :host {
            display: block;
            font-family: sans-serif;
            box-sizing: border-box;
            margin: auto;
        }

        .paging:not([active]) {
            display: none !important;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            padding: 12px;
            box-sizing: border-box;
        }

        .nav-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-top: 12px;
            overflow-y: auto;
            flex-grow: 1;
            /* Derive scrollbar colors from the (inherited) text color so they
               follow custom styles and themes — e.g. light thumb on dark nav. */
            scrollbar-width: thin;
            scrollbar-color: color-mix(in srgb, currentColor 35%, transparent) transparent;
        }

        /* WebKit/Blink fallback for browsers without scrollbar-color support. */
        .nav-list::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        .nav-list::-webkit-scrollbar-track {
            background: transparent;
        }

        .nav-list::-webkit-scrollbar-thumb {
            background-color: color-mix(in srgb, currentColor 35%, transparent);
            border-radius: 4px;
        }

        .nav-list::-webkit-scrollbar-thumb:hover {
            background-color: color-mix(in srgb, currentColor 55%, transparent);
        }

        .nav-item {
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 4px;
        }

        md-icon {
            font-family: 'Material Symbols Outlined';
        }

        /* Derive the highlight from the (inherited) text color, like the
           scrollbar above — a fixed black wash is invisible on a dark nav. */
        .selected {
            background-color: color-mix(in srgb, currentColor 15%, transparent);
        }

        h2 {
            margin: 0;
            padding: 0px;
            font-size: 1.2em;
            font-weight: var(--title-weight);
        }
    `

    render() {
        const fontSize = this.inputData?.style?.fontSize ?? 16
        const fontWeight = this.inputData?.style?.fontWeight ?? 400
        // the title is bold, and heavier still when the items are bold too
        const titleWeight = fontWeight >= 600 ? 900 : 700
        const iconFontSize = fontSize * 1.5
        const fontColor = this.inputData?.style?.color || this.themeTitleColor || 'black'
        const bgColor = this.inputData?.style?.backgroundColor || 'transparent'
        const gap = fontSize * 0.4
        return html`
            <div
                class="wrapper"
                style="background-color: ${bgColor}; color: ${fontColor};
                font-weight: ${fontWeight}; --title-weight: ${titleWeight};
                font-size: ${fontSize}px;"
            >
                <h2
                    class="paging"
                    style=${this.inputData?.route ? 'cursor: pointer' : ''}
                    ?active=${this.inputData?.title}
                    @click=${() =>
                        this.handleNavItemClick(
                            this.resolveRoute({
                                route: this.inputData?.route,
                                variables: this.inputData?.variables
                            })
                        )}
                >
                    ${this.inputData?.title}
                </h2>
                <div class="nav-list">
                    ${repeat(
                        this.inputData?.navItems || [],
                        (item) => item.label,
                        (item) => {
                            const icon = this.icons.name(item.iconName)
                            return html`
                                <div
                                    class="nav-item ${this.matchesRoute(this.resolveRoute(item))
                                        ? 'selected'
                                        : ''}"
                                    style="gap: ${gap}px;"
                                    @click=${() => this.handleNavItemClick(this.resolveRoute(item))}
                                >
                                    ${icon
                                        ? html`<md-icon style="--md-icon-size: ${iconFontSize}px;"
                                              >${icon}</md-icon
                                          >`
                                        : ''}
                                    ${item.label}
                                </div>
                            `
                        }
                    )}
                </div>
            </div>
            ${this.icons.probe()}
        `
    }
}
