import * as vscode from 'vscode';
import { AIService, CodeAnalysisResult } from './aiService';
import { getNonce } from './utils';

const translations: any = {
    es: {
        aiProvider: "Proveedor de IA",
        apiKeyPlaceholder: "API Key",
        fastLabel: "Rápido (s)",
        slowLabel: "Lento (s)",
        saveBtn: "Guardar Config",
        intentTitle: "¿Qué vas a hacer?",
        intentPlaceholder: "ej: crear un login",
        consultBtn: "🚀 Consultar Plan",
        analyzeBtn: "🔬 Analizar Código Actual",
        helpTitle: "📖 Guía del Panel",
        helpConfig: "<b>⚙️ Configuración:</b> Ajusta la IA y los tiempos. La IA Rápida analiza cambios cortos; la Detallada usa todo el contexto del proyecto.",
        helpAnalyze: "<b>🔬 Analizar Código:</b> Pulsa este botón para que la IA revise tu archivo actual y te proponga mejoras.",
        helpIntent: "<b>💡 ¿Qué vas a hacer?:</b> Escribe tu plan antes de programar para recibir dos estrategias alternativas (Caminos 1 y 2).",
        helpApply: "<b>✨ Aplicar Código:</b> Haz clic en este botón verde para insertar la propuesta directamente en tu editor.",
        helpStrategy: "<b>🧠 Estrategia Contraria:</b> Análisis crítico del código que tienes abierto en el editor.",
        loadingFast: "IA Rápida analizando...",
        loadingSlow: "IA Detallada refinando...",
        noFileWarning: "Abre un archivo para poder analizarlo.",
        configSaved: "¡Configuración guardada!",
        applySuccess: "¡Código aplicado con éxito!",
        applyError: "Error al insertar el código: ",
        openFileError: "Abre un archivo para poder aplicar el código.",
        pathLabel: "🛤️ Camino ",
        contrarianTitle: "🧠 Estrategia Contraria",
        errorsLabel: "⚠️ Errores Posibles",
        prosLabel: "✅ Ventajas",
        consLabel: "❌ Desventajas",
        detectedErrors: "🔴 Errores detectados",
        applyBtn: "✨ Aplicar Código",
        loadingProject: "Analizando proyecto completo...",
        projectFilesLabel: "Archivos del proyecto: ",
        fastAnalysisLabel: "ANÁLISIS RÁPIDO",
        detailedAnalysisLabel: "ANÁLISIS DETALLADO",
        notAvailable: "No disponible",
        notProvided: "No proporcionado",
        currentCodeLabel: "Código actual",
        previousAnalysis: "Análisis rápido previo"
    },
    en: {
        aiProvider: "AI Provider",
        apiKeyPlaceholder: "API Key",
        fastLabel: "Fast (s)",
        slowLabel: "Slow (s)",
        saveBtn: "Save Config",
        intentTitle: "What are you doing?",
        intentPlaceholder: "e.g., create a login",
        consultBtn: "🚀 Consult Plan",
        analyzeBtn: "🔬 Analyze Current Code",
        helpTitle: "📖 Panel Guide",
        helpConfig: "<b>⚙️ Configuration:</b> Adjust the AI and timings. Fast AI analyzes short changes; Detailed AI uses the full project context.",
        helpAnalyze: "<b>🔬 Analyze Code:</b> Click this button to have the AI review your current file and propose improvements.",
        helpIntent: "<b>💡 What are you doing?:</b> Write your plan before coding to receive two alternative strategies (Paths 1 and 2).",
        helpApply: "<b>✨ Apply Code:</b> Click this green button to insert the proposal directly into your editor.",
        helpStrategy: "<b>🧠 Contrarian Strategy:</b> Critical analysis of the code currently open in the editor.",
        loadingFast: "Fast AI analyzing...",
        loadingSlow: "Detailed AI refining...",
        noFileWarning: "Open a file to be able to analyze it.",
        configSaved: "Configuration saved!",
        applySuccess: "Code applied successfully!",
        applyError: "Error inserting code: ",
        openFileError: "Open a file to be able to apply code.",
        pathLabel: "🛤️ Path ",
        contrarianTitle: "🧠 Contrarian Strategy",
        errorsLabel: "⚠️ Potential Errors",
        prosLabel: "✅ Advantages",
        consLabel: "❌ Disadvantages",
        detectedErrors: "🔴 Detected errors",
        applyBtn: "✨ Apply Code",
        loadingProject: "Analyzing entire project...",
        projectFilesLabel: "Project files: ",
        fastAnalysisLabel: "FAST ANALYSIS",
        detailedAnalysisLabel: "DETAILED ANALYSIS",
        notAvailable: "Not available",
        notProvided: "Not provided",
        currentCodeLabel: "Current code",
        previousAnalysis: "Previous fast analysis"
    }
};

export function activate(context: vscode.ExtensionContext) {
    console.log('[ContrarianCoder] Extension activated.');

    const provider = new ContrarianWebviewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ContrarianWebviewProvider.viewType, provider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    provider.initialize();

    const disposable = vscode.commands.registerCommand('contrarian-coder.openPanel', () => {
        vscode.commands.executeCommand('workbench.view.extension.contrarian-sidebar');
    });

    context.subscriptions.push(disposable);
}

class ContrarianWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'contrarian-coder-view';
    private _view?: vscode.WebviewView;

    private _fastDelay: number = 25;
    private _slowDelay: number = 35;
    private _fastTimer: ReturnType<typeof setTimeout> | undefined;
    private _slowTimer: ReturnType<typeof setTimeout> | undefined;
    private _lastFastResult: CodeAnalysisResult | null = null;
    private _lastAnalysisResult: CodeAnalysisResult | null = null;
    private _isAnalyzingRef: 'fast' | 'slow' | 'project' | null = null;
    private _apiKey: string | undefined;
    private _userIntent: string = '';
    private _language: string = 'es';

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._updateConfig();
    }

    public async initialize() {
        await this._loadApiKey();
    }

    private _updateConfig() {
        const config = vscode.workspace.getConfiguration('contrarianCoder');
        this._fastDelay = config.get<number>('fastDelay', 0) * 1000;
        this._slowDelay = config.get<number>('slowDelay', 0) * 1000;
        this._language = config.get<string>('language', 'es');
    }

    private async _loadApiKey() {
        this._apiKey = await this._context.secrets.get('aiApiKey');
        this._refreshWebviewHtml();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };
        this._refreshWebviewHtml();

        webviewView.webview.onDidReceiveMessage(async (data: { type: string; config?: any; intent?: string; code?: string; originalCodeToReplace?: string }) => {
            switch (data.type) {
                case 'ready':
                    if (this._isAnalyzingRef === 'project') {
                        this._view?.webview.postMessage({ type: 'loadingProject', value: true });
                    } else if (this._isAnalyzingRef === 'fast') {
                        this._view?.webview.postMessage({ type: 'loadingFast', value: true });
                    } else if (this._isAnalyzingRef === 'slow') {
                        if (this._lastFastResult) {
                            this._view?.webview.postMessage({ type: 'fastResult', analysis: this._lastFastResult });
                        }
                        this._view?.webview.postMessage({ type: 'loadingSlow', value: true });
                    } else if (this._lastAnalysisResult) {
                        this._view?.webview.postMessage({ type: 'slowResult', analysis: this._lastAnalysisResult });
                    }
                    if (this._userIntent) {
                        this._view?.webview.postMessage({ type: 'restoreIntent', intent: this._userIntent });
                    }
                    break;
                case 'saveConfig':
                    await this._handleSaveConfig(data.config);
                    break;
                case 'manualAnalyze':
                    if (vscode.window.activeTextEditor) {
                        this.updateAnalysis(vscode.window.activeTextEditor.document.getText(), true);
                    } else {
                        const projectCode = await this._getFullProjectContent();
                        this.updateAnalysis(projectCode, true, true);
                    }
                    break;
                case 'updateIntent':
                    this._userIntent = data.intent || '';
                    if (vscode.window.activeTextEditor) {
                        this.updateAnalysis(vscode.window.activeTextEditor.document.getText(), true);
                    } else {
                        const projectCode = await this._getFullProjectContent();
                        this.updateAnalysis(projectCode, true, true);
                    }
                    break;
                case 'changeLanguage':
                    if (data.config && data.config.language) {
                        const vsConfig = vscode.workspace.getConfiguration('contrarianCoder');
                        await vsConfig.update('language', data.config.language, vscode.ConfigurationTarget.Global);
                        this._updateConfig();
                        this._refreshWebviewHtml();
                    }
                    break;
                case 'applyCode':
                    if (data.code) {
                        this._applyCodeToEditor(data.code, data.originalCodeToReplace);
                    }
                    break;
            }
        });
    }

    private async _applyCodeToEditor(code: string, originalCodeToReplace?: string) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage(translations[this._language].openFileError);
            return;
        }

        try {
            await editor.edit(editBuilder => {
                if (!editor.selection.isEmpty) {
                    editBuilder.replace(editor.selection, code);
                } else if (originalCodeToReplace) {
                    const documentText = editor.document.getText();
                    const index = documentText.indexOf(originalCodeToReplace);
                    if (index !== -1) {
                        const startPos = editor.document.positionAt(index);
                        const endPos = editor.document.positionAt(index + originalCodeToReplace.length);
                        editBuilder.replace(new vscode.Range(startPos, endPos), code);
                    } else {
                        vscode.window.showWarningMessage('No se detectó el bloque original, se insertará en el cursor.');
                        editBuilder.insert(editor.selection.active, code);
                    }
                } else {
                    editBuilder.insert(editor.selection.active, code);
                }
            });
            vscode.window.showInformationMessage(translations[this._language].applySuccess);
        } catch (err) {
            vscode.window.showErrorMessage(translations[this._language].applyError + String(err));
        }
    }

    private _refreshWebviewHtml() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private async _handleSaveConfig(config: any): Promise<void> {
        if (!config) return;
        try {
            const vsConfig = vscode.workspace.getConfiguration('contrarianCoder');
            await Promise.all([
                vsConfig.update('fastDelay', config.fastDelay, vscode.ConfigurationTarget.Global),
                vsConfig.update('slowDelay', config.slowDelay, vscode.ConfigurationTarget.Global),
                vsConfig.update('aiProvider', config.aiProvider, vscode.ConfigurationTarget.Global),
                vsConfig.update('language', config.language, vscode.ConfigurationTarget.Global)
            ]);
            if (config.aiApiKey && config.aiApiKey.trim() !== "") {
                await this._context.secrets.store('aiApiKey', config.aiApiKey);
                this._apiKey = config.aiApiKey;
            }
            this._updateConfig();
            vscode.window.showInformationMessage(translations[this._language].configSaved);
            await this._loadApiKey();
        } catch (err: unknown) {
            vscode.window.showErrorMessage('Error al guardar: ' + String(err));
        }
    }

    public async updateAnalysis(code: string, force: boolean = false, isProject: boolean = false) {
        if (this._fastTimer) clearTimeout(this._fastTimer);
        if (this._slowTimer) clearTimeout(this._slowTimer);
        if (!code.trim()) {
            this._lastAnalysisResult = null;
            this._isAnalyzingRef = null;
            this._view?.webview.postMessage({ type: 'clear' });
            return;
        }

        if (this._apiKey === undefined) await this._loadApiKey();

        if (this._view) {
            this._isAnalyzingRef = isProject ? 'project' : 'fast';
            this._view.webview.postMessage({ type: isProject ? 'loadingProject' : 'loadingFast', value: true });
            const context = await this._gatherProjectContext();
            const analysis = await this._analyzeFast(code, this._apiKey, this._userIntent, context);
            this._lastFastResult = analysis;
            this._lastAnalysisResult = analysis;
            analysis.isFast = true;
            this._isAnalyzingRef = 'slow';

            this._view.webview.postMessage({ type: 'fastResult', analysis });
            this._view.webview.postMessage({ type: isProject ? 'loadingProject' : 'loadingFast', value: false });

            this._view.webview.postMessage({ type: 'loadingSlow', value: true });
            const slowAnalysis = await this._analyzeDetailed(code, this._lastFastResult, context, this._apiKey, this._userIntent);
            slowAnalysis.isFast = false;
            this._lastAnalysisResult = slowAnalysis;
            this._isAnalyzingRef = null;
            this._view.webview.postMessage({ type: 'slowResult', analysis: slowAnalysis });
            this._view.webview.postMessage({ type: 'loadingSlow', value: false });
        }
    }

    private async _gatherProjectContext(): Promise<string> {
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
        const t = translations[this._language];
        return `${t.projectFilesLabel}${files.slice(0, 30).map(f => f.fsPath.split(/[\\\/]/).pop()).join(', ')}`;
    }

    private async _getFullProjectContent(): Promise<string> {
        const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,html,css,json}', '**/node_modules/**');
        let combinedCode = "";
        let totalChars = 0;
        const maxChars = 20000;

        for (const file of files.slice(0, 15)) {
            if (totalChars > maxChars) break;
            try {
                const doc = await vscode.workspace.openTextDocument(file);
                const text = doc.getText();
                const header = `\n--- FILE: ${vscode.workspace.asRelativePath(file)} ---\n`;
                combinedCode += header + text;
                totalChars += text.length + header.length;
            } catch (e) {
                console.error(`Error reading ${file.fsPath}:`, e);
            }
        }
        return combinedCode;
    }

    private _getSystemPrompt(): string {
        const langName = this._language === 'es' ? 'Spanish' : 'English';
        return `
# ROLE: CONTRARIAN CODER
You are a Senior Software Architect and Systems Analyst known as "Contrarian Coder." You possess a highly critical eye and a bias toward high-performance, scalable, and maintainable architectures. You despise "junior-level" code and always look for edge cases, performance bottlenecks, and architectural smells.

# OBJECTIVE
Your task is to analyze the provided code/context and offer **two distinct architectural approaches** to improve or extend the logic. One of these approaches must represent your "Contrarian" perspective—a highly optimized or unconventional yet superior professional solution.

# STRICT OPERATIONAL RULES
1. **JSON ONLY:** Your entire response must be a single, valid JSON object. Do not include any text before or after the JSON.
2. **ZERO FILLER:** No greetings, intros, or outros.
3. **LOGICAL INFERENCE:** If the user does not provide a specific "intent" or instruction, analyze the context to propose the most logical next steps or critical refactors needed.
4. **LANGUAGE REQUIREMENT:** All explanations, descriptions, and list items within the JSON **must be written in professional ${langName}**. The code itself must use English naming conventions (industry standard).
5. **CODE QUALITY:** The code provided in the \`contrarianWay\` and \`approaches\` fields must be functional, production-ready, and optimized. No placeholders.

# RESPONSE SCHEMA (JSON)
{
  "originalCodeToReplace": "Exact block of the user's code to be replaced (without changes)",
  "contrarianWay": "Full functional and optimized code implementation here",
  "originalErrors": ["Detailed error/bottleneck 1 in ${langName}", "Detailed error/bottleneck 2 in ${langName}"],
  "advantages": ["Advantage 1 of the contrarian approach in ${langName}"],
  "disadvantages": ["Potential trade-off 1 of the contrarian approach in ${langName}"],
  "approaches": [
    {
      "title": "Short title of the alternative approach",
      "description": "Detailed description in ${langName}",
      "originalCodeToReplace": "Exact block of the user's code to be replaced (without changes)",
      "code": "Functional code for this approach",
      "potentialErrors": ["List of risks in ${langName}"],
      "advantages": ["List of benefits in ${langName}"],
      "disadvantages": ["List of drawbacks in ${langName}"]
    }
  ]
}

# REASONING PROTOCOL (INTERNAL)
Before generating the JSON, you must internally:
1. Identify architectural flaws (coupling, complexity, lack of patterns).
2. Evaluate performance (O(n) complexity, memory usage, I/O blocking).
3. Design a "Standard Professional" path vs. a "Contrarian/Highly Optimized" path.
4. Ensure the ${langName} used is technical and precise (e.g., using terms like "acoplamiento," "escalabilidad," "concurrencia" in Spanish, or "coupling," "scalability," "concurrency" in English).
`;
    }

    private async _analyzeFast(code: string, apiKey: string | undefined, intent?: string, ctx?: string): Promise<CodeAnalysisResult> {
        const system = this._getSystemPrompt();
        const t = translations[this._language];
        const userPrompt = `[${t.fastAnalysisLabel}]
${t.projectFilesLabel} ${ctx || t.notAvailable}.
${t.intentTitle}: ${intent || t.notProvided}.
${t.currentCodeLabel}:\n${code}`;

        const fullPrompt = `${system}\n\n${userPrompt}`;
        return AIService.analyze(fullPrompt, this._language, apiKey);
    }

    private async _analyzeDetailed(code: string, fast: CodeAnalysisResult | null, ctx: string, apiKey: string | undefined, intent?: string): Promise<CodeAnalysisResult> {
        const system = this._getSystemPrompt();
        const t = translations[this._language];
        const userPrompt = `[${t.detailedAnalysisLabel}]
${t.previousAnalysis}: ${JSON.stringify(fast)}
${t.projectFilesLabel} ${ctx}
${t.intentTitle}: ${intent || t.notProvided}
${t.currentCodeLabel}:\n${code}`;

        const fullPrompt = `${system}\n\n${userPrompt}`;
        return AIService.analyze(fullPrompt, this._language, apiKey);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();
        const config = vscode.workspace.getConfiguration('contrarianCoder');
        const hasKey = this._apiKey !== undefined && this._apiKey !== "";
        const t = translations[this._language];

        return `<!DOCTYPE html>
            <html lang="${this._language}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline';">
                <style>
                    body { font-family: sans-serif; background: #252526; color: #ccc; margin: 0; padding: 10px; font-size: 12px; line-height: 1.4; }
                    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                    .lang-toggle { display: flex; background: #333; border-radius: 4px; padding: 2px; }
                    .lang-btn { background: transparent; color: #aaa; border: none; padding: 4px 8px; font-size: 10px; cursor: pointer; border-radius: 3px; width: auto; font-weight: normal; }
                    .lang-btn.active { background: #007acc; color: white; font-weight: bold; }
                    
                    .config-panel { background: #333; padding: 10px; border-radius: 4px; margin-bottom: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                    .config-panel input, .config-panel select, textarea { background: #1e1e1e; border: 1px solid #555; color: #eee; width: 100%; box-sizing: border-box; padding: 4px; border-radius: 2px; }
                    button { background: #007acc; color: #fff; border: none; padding: 6px; border-radius: 2px; cursor: pointer; width: 100%; font-weight: bold; }
                    .intent-box { background: #1e1e1e; padding: 10px; border-radius: 4px; border-left: 4px solid #6a3d9a; margin-bottom: 15px; }
                    .intent-box button { background: #6a3d9a; margin-top: 6px; }
                    
                    #results { margin-top: 10px; }
                    .card { background: #2d2d2d; border: 1px solid #444; padding: 12px; border-radius: 6px; margin-bottom: 15px; animation: fadeIn 0.4s; position: relative; }
                    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    .card h2 { margin: 0 0 8px 0; font-size: 13px; color: #4fc1ff; display: flex; align-items: center; gap: 6px; }
                    .approach-card { border-color: #6a3d9a; background: rgba(106, 61, 154, 0.05); }
                    .approach-card h2 { color: #b180d7; }
                    pre { background: #000; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 11px; border: 1px solid #333; margin: 8px 0; }
                    .apply-btn { background: #388e3c; margin-bottom: 10px; font-size: 11px; padding: 6px 10px; width: auto; display: inline-block; cursor: pointer; border-radius: 4px; transition: 0.2s; }
                    .apply-btn:hover { background: #43a047; transform: scale(1.02); }
                    .list-section { margin: 10px 0; }
                    .list-section strong { display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; opacity: 0.8; }
                    .errors { color: #f48771; }
                    .pros { color: #89d185; }
                    .cons { color: #f48771; border-top: 1px solid #444; padding-top: 5px; }
                    ul { margin: 0; padding-left: 20px; }
                    li { margin-bottom: 3px; }
                    .loader { text-align: center; padding: 10px; color: #aaa; font-style: italic; border: 1px dashed #444; border-radius: 6px; margin: 5px 0; }
                    
                    .analyze-btn { background: #007acc; padding: 10px; font-size: 12px; margin-bottom: 15px; }
                    .analyze-btn:hover { background: #0062a3; }

                    .help-section { background: rgba(0, 122, 204, 0.05); border: 1px solid rgba(0, 122, 204, 0.2); border-radius: 4px; padding: 10px; margin-top: 20px; }
                    .help-section h3 { margin: 0 0 8px 0; font-size: 12px; color: #007acc; display: flex; justify-content: space-between; cursor: pointer; }
                    .help-content { display: none; margin-top: 8px; font-size: 11px; }
                    .help-content p { margin: 0 0 8px 0; }
                    .help-content b { color: #fff; }
                    .help-section.open .help-content { display: block; }
                </style>
            </head>
            <body>
                <div class="header-row">
                    <div style="font-weight: bold; color: #888; font-size: 10px;">CONTRARIAN CODER</div>
                    <div class="lang-toggle">
                        <button id="lang-es" class="lang-btn ${this._language === 'es' ? 'active' : ''}">ES</button>
                        <button id="lang-en" class="lang-btn ${this._language === 'en' ? 'active' : ''}">EN</button>
                    </div>
                </div>

                <div class="config-panel">
                    <div style="grid-column: span 2;">
                        <label style="font-size: 10px; color: #aaa;">${t.aiProvider}</label>
                        <select id="aiProvider">
                            <option value="openrouter" ${config.get('aiProvider') === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
                            <option value="gemini" ${config.get('aiProvider') === 'gemini' ? 'selected' : ''}>Gemini</option>
                        </select>
                    </div>
                    <div style="grid-column: span 2;">
                        <input type="password" id="aiApiKey" placeholder="${hasKey ? '••••••••••••' : t.apiKeyPlaceholder}">
                    </div>
                    <input type="number" id="fastDelay" value="${config.get('fastDelay')}" placeholder="${t.fastLabel}">
                    <input type="number" id="slowDelay" value="${config.get('slowDelay')}" placeholder="${t.slowLabel}">
                    <button id="saveBtn" style="grid-column: span 2;">${t.saveBtn}</button>
                </div>

                <div class="intent-box">
                    <strong>${t.intentTitle}</strong>
                    <textarea id="intentInput" rows="2" placeholder="${t.intentPlaceholder}">${this._userIntent}</textarea>
                    <button id="consultBtn">${t.consultBtn}</button>
                </div>

                <button id="analyzeManualBtn" class="analyze-btn">${t.analyzeBtn}</button>

                <div id="status"></div>
                <div id="results"></div>

                <div class="help-section" id="helpSection">
                    <h3 id="helpToggle">${t.helpTitle} <span id="helpArrow">▼</span></h3>
                    <div class="help-content">
                        <p>${t.helpConfig}</p>
                        <p>${t.helpAnalyze}</p>
                        <p>${t.helpIntent}</p>
                        <p>${t.helpApply}</p>
                        <p>${t.helpStrategy}</p>
                    </div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const resultsDiv = document.getElementById('results');
                    const statusDiv = document.getElementById('status');
                    
                    let currentAnalysis = null;

                    // Restaurar estado al recargar la vista
                    const previousState = vscode.getState();
                    if (previousState && previousState.analysis) {
                        currentAnalysis = previousState.analysis;
                        renderAnalysis(currentAnalysis);
                    }

                    document.getElementById('lang-es').onclick = () => {
                        vscode.postMessage({ type: 'changeLanguage', config: { language: 'es' } });
                    };
                    document.getElementById('lang-en').onclick = () => {
                        vscode.postMessage({ type: 'changeLanguage', config: { language: 'en' } });
                    };

                    document.getElementById('helpToggle').onclick = () => {
                        const sec = document.getElementById('helpSection');
                        const arrow = document.getElementById('helpArrow');
                        sec.classList.toggle('open');
                        arrow.innerText = sec.classList.contains('open') ? '▲' : '▼';
                    };

                    document.getElementById('saveBtn').onclick = () => {
                        vscode.postMessage({ type: 'saveConfig', config: {
                            fastDelay: parseInt(document.getElementById('fastDelay').value) || 0,
                            slowDelay: parseInt(document.getElementById('slowDelay').value) || 0,
                            aiProvider: document.getElementById('aiProvider').value,
                            aiApiKey: document.getElementById('aiApiKey').value,
                            language: '${this._language}'
                        }});
                    };

                    document.getElementById('consultBtn').onclick = () => {
                        const intent = document.getElementById('intentInput').value;
                        vscode.setState({ analysis: currentAnalysis, intent: intent });
                        vscode.postMessage({ type: 'updateIntent', intent: intent });
                    };

                    // Guardar el input "intent" si el usuario lo escribe, para que no se borre
                    document.getElementById('intentInput').addEventListener('input', (e) => {
                        vscode.setState({ analysis: currentAnalysis, intent: e.target.value });
                    });
                    if (previousState && previousState.intent) {
                        document.getElementById('intentInput').value = previousState.intent;
                    }

                    document.getElementById('analyzeManualBtn').onclick = () => {
                        vscode.postMessage({ type: 'manualAnalyze' });
                    };

                    function sendApplyCode(code, originalToReplace) {
                        if (!code) return;
                        vscode.postMessage({ type: 'applyCode', code: code, originalCodeToReplace: originalToReplace });
                    }
                    window.sendApplyCode = sendApplyCode;

                    window.addEventListener('message', event => {
                        const msg = event.data;
                        if (msg.type === 'restoreIntent') {
                            document.getElementById('intentInput').value = msg.intent;
                        }
                        if (msg.type === 'clear') { 
                            resultsDiv.innerHTML = ''; statusDiv.innerHTML = ''; currentAnalysis = null; 
                            vscode.setState({ analysis: null, intent: document.getElementById('intentInput').value });
                        }
                        if (msg.type === 'loadingProject') { statusDiv.innerHTML = msg.value ? '<div class="loader">${t.loadingProject}</div>' : ''; }
                        if (msg.type === 'loadingFast') { statusDiv.innerHTML = msg.value ? '<div class="loader">${t.loadingFast}</div>' : ''; }
                        if (msg.type === 'loadingSlow') { statusDiv.innerHTML = msg.value ? '<div class="loader">${t.loadingSlow}</div>' : ''; }
                        if (msg.type === 'fastResult' || msg.type === 'slowResult') { 
                            currentAnalysis = msg.analysis;
                            renderAnalysis(msg.analysis); 
                            vscode.setState({ analysis: msg.analysis, intent: document.getElementById('intentInput').value });
                        }
                    });

                    function renderAnalysis(res) {
                        let html = '';
                        if (res.error) { html = '<div class="card" style="border-color: #f48771;">' + res.error + '</div>'; }
                        else {
                            if (res.approaches && res.approaches.length > 0) {
                                res.approaches.forEach((app, i) => {
                                    html += '<div class="card approach-card">' +
                                        '<h2>${t.pathLabel}' + (i+1) + ': ' + app.title + '</h2>' +
                                        '<p>' + app.description + '</p>' +
                                        (app.code ? '<pre><code>' + escapeHtml(app.code) + '</code></pre>' : '') +
                                        (app.code ? '<button class="apply-btn" id="btn-app-' + i + '">${t.applyBtn}</button>' : '') +
                                        renderList('${t.errorsLabel}', app.potentialErrors, 'errors') +
                                        renderList('${t.prosLabel}', app.advantages, 'pros') +
                                        renderList('${t.consLabel}', app.disadvantages, 'cons') +
                                        '</div>';
                                });
                            }
                            if (res.contrarianWay) {
                                html += '<div class="card">' +
                                    '<h2>${t.contrarianTitle}</h2>' +
                                    '<pre><code>' + escapeHtml(res.contrarianWay) + '</code></pre>' +
                                    '<button class="apply-btn" id="btn-contrarian">${t.applyBtn}</button>' +
                                    renderList('${t.prosLabel}', res.advantages, 'pros') +
                                    renderList('${t.consLabel}', res.disadvantages, 'cons') +
                                    renderList('${t.detectedErrors}', res.originalErrors, 'errors') +
                                    '</div>';
                            }
                        }
                        resultsDiv.innerHTML = html;

                        if (res.approaches) {
                            res.approaches.forEach((app, i) => {
                                const btn = document.getElementById('btn-app-' + i);
                                if (btn) btn.onclick = () => sendApplyCode(app.code, app.originalCodeToReplace);
                            });
                        }
                        const cBtn = document.getElementById('btn-contrarian');
                        if (cBtn) cBtn.onclick = () => sendApplyCode(res.contrarianWay, res.originalCodeToReplace);
                    }

                    function escapeHtml(unsafe) {
                        return unsafe
                             .replace(/&/g, "&amp;")
                             .replace(/</g, "&lt;")
                             .replace(/>/g, "&gt;")
                             .replace(/"/g, "&quot;")
                             .replace(/'/g, "&#039;");
                    }

                    function renderList(title, items, className) {
                        if (!items || items.length === 0) return '';
                        return '<div class="list-section ' + className + '"><strong>' + title + '</strong><ul>' +
                            items.map(it => '<li>' + it + '</li>').join('') + '</ul></div>';
                    }
                    
                    vscode.postMessage({ type: 'ready' });
                </script>
            </body>
            </html>`;
    }
}

export function deactivate() { }
