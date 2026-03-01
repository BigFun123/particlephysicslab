(function () {
    // Greek letters and special symbols
    const SYMBOLS = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
        '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
        '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ',
        '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π',
        '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ',
        '\\phi': 'φ', '\\varphi': 'φ', '\\chi': 'χ', '\\psi': 'ψ',
        '\\omega': 'ω',
        '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
        '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
        '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
        '\\hbar': 'ℏ', '\\infty': '∞', '\\nabla': '∇', '\\partial': '∂',
        '\\forall': '∀', '\\exists': '∃', '\\emptyset': '∅',
        '\\times': '×', '\\cdot': '·', '\\circ': '∘', '\\bullet': '•',
        '\\pm': '±', '\\mp': '∓', '\\div': '÷',
        '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
        '\\equiv': '≡', '\\sim': '∼', '\\propto': '∝',
        '\\leftarrow': '←', '\\rightarrow': '→', '\\leftrightarrow': '↔',
        '\\Leftarrow': '⇐', '\\Rightarrow': '⇒', '\\Leftrightarrow': '⇔',
        '\\uparrow': '↑', '\\downarrow': '↓',
        '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃',
        '\\cup': '∪', '\\cap': '∩',
        '\\sum': '∑', '\\prod': '∏', '\\int': '∫', '\\oint': '∮',
        '\\sqrt': '√', '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮',
        '\\quad': '\u2003', '\\qquad': '\u2003\u2003', '\\ ': '\u00a0', '\\,': '\u2009',
        '\\!': '', '\\;': '\u2004',
        '\\langle': '⟨', '\\rangle': '⟩',
        '\\|': '‖', '\\{': '{', '\\}': '}',
        '\\hat': '', // handled specially
        '\\vec': '', // handled specially
        '\\bar': '', // handled specially
        '\\dot': '', // handled specially
        '\\tilde': '', // handled specially
        '\\exp': '<mi>exp</mi>',
        '\\ln': '<mi>ln</mi>',
        '\\log': '<mi>log</mi>',
        '\\sin': '<mi>sin</mi>',
        '\\cos': '<mi>cos</mi>',
        '\\tan': '<mi>tan</mi>',
        '\\lim': '<mi>lim</mi>',
        '\\max': '<mi>max</mi>',
        '\\min': '<mi>min</mi>',
        '\\text': '', // handled specially
        '\\mathrm': '', // handled specially
        '\\mathbf': '', // handled specially
        '\\mathit': '', // handled specially
        '\\mathcal': '', // handled specially
        '\\boldsymbol': '', // handled specially
        '\\left': '', // handled specially
        '\\right': '', // handled specially
        '\\overline': '', // handled specially
        '\\underbrace': '', // handled specially
        '\\overbrace': '', // handled specially
    };

    const ACCENT_MAP = {
        '\\hat': 'ˆ', '\\vec': '⃗', '\\bar': '̄', '\\dot': '̇', '\\tilde': '̃',
        '\\ddot': '̈', '\\check': 'ˇ', '\\breve': '˘', '\\acute': '´', '\\grave': '`'
    };

    // Tokenizer
    function tokenize(input) {
        const tokens = [];
        let i = 0;
        while (i < input.length) {
            if (input[i] === '\\') {
                // command
                let cmd = '\\';
                i++;
                if (i < input.length && /[a-zA-Z]/.test(input[i])) {
                    while (i < input.length && /[a-zA-Z]/.test(input[i])) {
                        cmd += input[i++];
                    }
                    // skip trailing space after command
                    // but keep space for \quad etc
                } else if (i < input.length) {
                    cmd += input[i++];
                }
                tokens.push({ type: 'cmd', value: cmd });
            } else if (input[i] === '{') {
                tokens.push({ type: 'lbrace' });
                i++;
            } else if (input[i] === '}') {
                tokens.push({ type: 'rbrace' });
                i++;
            } else if (input[i] === '^') {
                tokens.push({ type: 'sup' });
                i++;
            } else if (input[i] === '_') {
                tokens.push({ type: 'sub' });
                i++;
            } else if (input[i] === ' ' || input[i] === '\t' || input[i] === '\n') {
                i++;
            } else if (input[i] === '&') {
                tokens.push({ type: 'align' });
                i++;
            } else {
                tokens.push({ type: 'char', value: input[i++] });
            }
        }
        return tokens;
    }

    // Parse token stream into an AST node list
    function parseGroup(tokens, pos) {
        const nodes = [];
        while (pos < tokens.length) {
            const tok = tokens[pos];
            if (tok.type === 'rbrace') { pos++; break; }
            const [node, newPos] = parseNode(tokens, pos);
            if (node) nodes.push(node);
            pos = newPos;
        }
        return [nodes, pos];
    }

    function parseNode(tokens, pos) {
        const tok = tokens[pos];
        if (!tok) return [null, pos + 1];

        if (tok.type === 'rbrace') return [null, pos]; // let caller handle

        if (tok.type === 'char') {
            let node = { type: 'char', value: tok.value };
            pos++;
            // check for sup/sub
            [node, pos] = parseSupSub(node, tokens, pos);
            return [node, pos];
        }

        if (tok.type === 'lbrace') {
            pos++;
            const [children, newPos] = parseGroup(tokens, pos);
            let node = { type: 'group', children };
            pos = newPos;
            [node, pos] = parseSupSub(node, tokens, pos);
            return [node, pos];
        }

        if (tok.type === 'cmd') {
            return parseCmd(tokens, pos);
        }

        if (tok.type === 'sup') {
            pos++;
            const [arg, newPos] = parseSingleArg(tokens, pos);
            return [{ type: 'sup', base: null, exp: arg }, newPos];
        }

        if (tok.type === 'sub') {
            pos++;
            const [arg, newPos] = parseSingleArg(tokens, pos);
            return [{ type: 'sub', base: null, sub: arg }, newPos];
        }

        return [null, pos + 1];
    }

    function parseSingleArg(tokens, pos) {
        if (pos >= tokens.length) return [{ type: 'group', children: [] }, pos];
        const tok = tokens[pos];
        if (tok.type === 'lbrace') {
            pos++;
            const [children, newPos] = parseGroup(tokens, pos);
            return [{ type: 'group', children }, newPos];
        }
        const [node, newPos] = parseNode(tokens, pos);
        return [node || { type: 'group', children: [] }, newPos];
    }

    function parseSupSub(node, tokens, pos) {
        let hasSup = false, hasSub = false;
        let sup = null, sub = null;
        while (pos < tokens.length && (tokens[pos].type === 'sup' || tokens[pos].type === 'sub')) {
            if (tokens[pos].type === 'sup' && !hasSup) {
                pos++;
                [sup, pos] = parseSingleArg(tokens, pos);
                hasSup = true;
            } else if (tokens[pos].type === 'sub' && !hasSub) {
                pos++;
                [sub, pos] = parseSingleArg(tokens, pos);
                hasSub = true;
            } else break;
        }
        if (hasSup || hasSub) {
            return [{ type: 'supsub', base: node, sup, sub }, pos];
        }
        return [node, pos];
    }

    function parseCmd(tokens, pos) {
        const cmd = tokens[pos].value;
        pos++;

        // \frac{num}{den}
        if (cmd === '\\frac') {
            const [num, pos2] = parseSingleArg(tokens, pos);
            const [den, pos3] = parseSingleArg(tokens, pos2);
            let node = { type: 'frac', num, den };
            [node, pos] = parseSupSub(node, tokens, pos3);
            return [node, pos];
        }

        // operators as text: \exp \sin etc
        if (['\\exp','\\ln','\\log','\\sin','\\cos','\\tan','\\lim','\\max','\\min','\\det','\\dim'].includes(cmd)) {
            let node = { type: 'op', value: cmd.slice(1) };
            [node, pos] = parseSupSub(node, tokens, pos);
            return [node, pos];
        }

        // styled text: \mathbf{...} \text{...} etc
        if (['\\mathbf','\\mathit','\\mathrm','\\mathcal','\\boldsymbol','\\text','\\mbox'].includes(cmd)) {
            const [arg, newPos] = parseSingleArg(tokens, pos);
            let node = { type: 'styled', style: cmd, children: arg };
            [node, pos] = parseSupSub(node, tokens, newPos);
            return [node, pos];
        }

        // accents: \hat{x}
        if (ACCENT_MAP[cmd] !== undefined) {
            const [arg, newPos] = parseSingleArg(tokens, pos);
            let node = { type: 'accent', accent: cmd, children: arg };
            [node, pos] = parseSupSub(node, tokens, newPos);
            return [node, pos];
        }

        // \sqrt[n]{x}
        if (cmd === '\\sqrt') {
            let index = null;
            if (pos < tokens.length && tokens[pos] && tokens[pos].type === 'char' && tokens[pos].value === '[') {
                // optional arg
                pos++;
                const indexParts = [];
                while (pos < tokens.length && !(tokens[pos].type === 'char' && tokens[pos].value === ']')) {
                    indexParts.push(tokens[pos]);
                    pos++;
                }
                pos++; // skip ]
                index = indexParts.map(t => t.value || '').join('');
            }
            const [arg, newPos] = parseSingleArg(tokens, pos);
            let node = { type: 'sqrt', index, children: arg };
            [node, pos] = parseSupSub(node, tokens, newPos);
            return [node, pos];
        }

        // \left and \right - just absorb the following delimiter
        if (cmd === '\\left' || cmd === '\\right') {
            let delim = '';
            if (pos < tokens.length) {
                const t = tokens[pos];
                if (t.type === 'char' || t.type === 'cmd') {
                    delim = t.type === 'cmd' ? t.value : t.value;
                    pos++;
                }
            }
            return [{ type: 'delim', side: cmd, delim }, pos];
        }

        // \overline{x}
        if (cmd === '\\overline' || cmd === '\\underline') {
            const [arg, newPos] = parseSingleArg(tokens, pos);
            let node = { type: 'overline', style: cmd, children: arg };
            [node, pos] = parseSupSub(node, tokens, newPos);
            return [node, pos];
        }

        // everything else: symbol lookup
        const sym = SYMBOLS[cmd];
        let node;
        if (sym !== undefined && sym !== '' && !sym.startsWith('<')) {
            node = { type: 'symbol', value: sym, cmd };
        } else if (sym && sym.startsWith('<')) {
            node = { type: 'rawhtml', value: sym };
        } else {
            // Unknown command: render as text
            node = { type: 'op', value: cmd.slice(1) };
        }
        [node, pos] = parseSupSub(node, tokens, pos);
        return [node, pos];
    }

    // Render AST node to HTML string
    function renderNode(node) {
        if (!node) return '';
        switch (node.type) {
            case 'char': {
                const v = node.value;
                if (v === '-') return '<span class="mj-op">−</span>';
                if (v === '=') return '<span class="mj-op">=</span>';
                if (v === '+') return '<span class="mj-op">+</span>';
                if (/[0-9]/.test(v)) return `<span class="mj-num">${v}</span>`;
                if (/[a-zA-Z]/.test(v)) return `<span class="mj-var">${v}</span>`;
                return `<span class="mj-char">${escHtml(v)}</span>`;
            }
            case 'group':
                return node.children.map(renderNode).join('');
            case 'symbol':
                return `<span class="mj-sym">${escHtml(node.value)}</span>`;
            case 'rawhtml':
                return node.value;
            case 'op':
                return `<span class="mj-op mj-named">${escHtml(node.value)}</span>`;
            case 'frac':
                return `<span class="mj-frac"><span class="mj-num">${renderNode(node.num)}</span><span class="mj-den">${renderNode(node.den)}</span></span>`;
            case 'supsub': {
                const base = renderNode(node.base);
                if (node.sup && node.sub) {
                    return `<span class="mj-supsub">${base}<span class="mj-scripts"><sup class="mj-sup">${renderNode(node.sup)}</sup><sub class="mj-sub">${renderNode(node.sub)}</sub></span></span>`;
                }
                if (node.sup) return `<span class="mj-supsub">${base}<sup class="mj-sup">${renderNode(node.sup)}</sup></span>`;
                if (node.sub) return `<span class="mj-supsub">${base}<sub class="mj-sub">${renderNode(node.sub)}</sub></span>`;
                return base;
            }
            case 'styled': {
                const inner = renderNode(node.children);
                if (node.style === '\\mathbf' || node.style === '\\boldsymbol') {
                    return `<span class="mj-bold">${inner}</span>`;
                }
                if (node.style === '\\mathit') return `<span class="mj-it">${inner}</span>`;
                if (node.style === '\\text' || node.style === '\\mbox') return `<span class="mj-text">${inner}</span>`;
                if (node.style === '\\mathcal') return `<span class="mj-cal">${inner}</span>`;
                return `<span class="mj-rm">${inner}</span>`;
            }
            case 'accent': {
                const inner = renderNode(node.children);
                const acc = ACCENT_MAP[node.accent] || '';
                return `<span class="mj-accent">${inner}<span class="mj-accmark">${acc}</span></span>`;
            }
            case 'sqrt': {
                const inner = renderNode(node.children);
                const idx = node.index ? `<sup class="mj-sqidx">${escHtml(node.index)}</sup>` : '';
                return `<span class="mj-sqrt">${idx}<span class="mj-sqrtrad">√</span><span class="mj-sqrtinner">${inner}</span></span>`;
            }
            case 'delim': {
                const delimMap = { '(': '(', ')': ')', '[': '[', ']': ']', '|': '|', '.': '', '\\|': '‖', '\\{': '{', '\\}': '}' };
                const d = delimMap[node.delim] !== undefined ? delimMap[node.delim] : escHtml(node.delim);
                return d ? `<span class="mj-delim">${d}</span>` : '';
            }
            case 'overline': {
                const inner = renderNode(node.children);
                if (node.style === '\\overline') return `<span class="mj-overline">${inner}</span>`;
                return `<span class="mj-underline">${inner}</span>`;
            }
            default:
                return '';
        }
    }

    function escHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function renderLatex(latex) {
        // Strip display math markers
        const stripped = latex.replace(/^\$\$/, '').replace(/\$\$$/, '').trim();
        if (!stripped) return '';

        const tokens = tokenize(stripped);
        const [nodes] = parseGroup(tokens, 0);
        const html = nodes.map(renderNode).join('');
        return `<span class="minijax-display">${html}</span>`;
    }

    // MathJax-compatible API
    window.MathJax = {
        typesetPromise: function (elements) {
            return new Promise((resolve) => {
                (elements || [document.body]).forEach(el => {
                    if (!el) return;
                    // Find all elements with $$ ... $$ text or innerHTML
                    processElement(el);
                });
                resolve();
            });
        },
        typeset: function (elements) {
            (elements || [document.body]).forEach(el => {
                if (el) processElement(el);
            });
        }
    };

    function processElement(el) {
        // If element directly contains LaTeX (set via innerHTML with $$)
        const raw = el.innerHTML || '';
        if (raw.includes('$$')) {
            el.innerHTML = raw.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
                return renderLatex('$$' + latex + '$$');
            });
            return;
        }
        // If element text content looks like LaTeX already rendered as $$...$$
        const text = el.textContent || '';
        if (text.includes('$$')) {
            el.innerHTML = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
                return renderLatex('$$' + latex + '$$');
            });
        }
    }

    // Inject styles
    function injectStyles() {
        const css = `
.minijax-display {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.05em;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 1.05em;
    line-height: 1.6;
    color: #88aaff;
    vertical-align: middle;
}
.mj-var { font-style: italic; }
.mj-num { font-style: normal; }
.mj-sym { font-style: normal; }
.mj-op { font-style: normal; padding: 0 0.15em; }
.mj-named { font-style: normal; font-family: inherit; }
.mj-bold { font-weight: bold; }
.mj-it { font-style: italic; }
.mj-rm { font-style: normal; }
.mj-text { font-family: sans-serif; font-style: normal; }
.mj-cal { font-family: 'Palatino Linotype', serif; font-style: italic; }
.mj-frac {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    vertical-align: middle;
    margin: 0 0.1em;
    gap: 0;
}
.mj-frac > .mj-num {
    border-bottom: 1px solid currentColor;
    padding: 0 0.1em 0.05em;
    text-align: center;
    line-height: 1.3;
    font-style: normal;
}
.mj-frac > .mj-den {
    padding: 0.05em 0.1em 0;
    text-align: center;
    line-height: 1.3;
}
.mj-supsub { display: inline-flex; align-items: baseline; }
.mj-scripts { display: inline-flex; flex-direction: column; align-items: flex-start; line-height: 1; }
.mj-sup { font-size: 0.7em; vertical-align: super; line-height: 1; }
.mj-sub { font-size: 0.7em; vertical-align: sub; line-height: 1; }
.mj-sqrt { display: inline-flex; align-items: center; }
.mj-sqrtrad { font-size: 1.1em; }
.mj-sqrtinner { border-top: 1px solid currentColor; padding: 0 0.1em; }
.mj-sqidx { font-size: 0.6em; vertical-align: super; margin-right: 0.1em; }
.mj-delim { font-size: 1.1em; }
.mj-overline { border-top: 1px solid currentColor; display: inline; }
.mj-underline { border-bottom: 1px solid currentColor; display: inline; }
.mj-accent { position: relative; display: inline-flex; flex-direction: column; align-items: center; }
.mj-accmark { font-size: 0.7em; line-height: 0.5; margin-bottom: 2px; }
.mj-char { font-style: normal; }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }
})();
