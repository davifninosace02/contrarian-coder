import * as vscode from 'vscode';
import * as https from 'https';

export interface CodeImprovement {
    title: string;
    description: string;
    priority: 'alta' | 'media' | 'baja';
    code?: string;
}

export interface ProposedApproach {
    title: string;
    description: string;
    code: string;
    originalCodeToReplace?: string;
    potentialErrors: string[];
    advantages: string[];
    disadvantages: string[];
}

export interface CodeAnalysisResult {
    originalCodeToReplace?: string;
    contrarianWay?: string;
    originalErrors?: string[];
    contrarianErrors?: string[];
    advantages?: string[];
    disadvantages?: string[];
    improvements?: CodeImprovement[];
    approaches?: ProposedApproach[];
    isFast?: boolean;
    error?: string;
}

const aiTranslations: Record<string, any> = {
    es: {
        errorKey: "Por favor, introduce una API Key en los ajustes de la extensión.",
        errorAPI: "IA: ",
        errorNoContent: "La IA no devolvió contenido.",
        errorInvalidJSON: "La IA no devolvió un JSON válido.",
        errorRead: "Error al leer la respuesta.",
        errorConn: "Error de conexión: ",
        errorTimeout: "Timeout: La IA tardó demasiado en responder (60s)."
    },
    en: {
        errorKey: "Please enter an API Key in the extension settings.",
        errorAPI: "AI: ",
        errorNoContent: "The AI did not return any content.",
        errorInvalidJSON: "The AI did not return valid JSON.",
        errorRead: "Error reading response.",
        errorConn: "Connection error: ",
        errorTimeout: "Timeout: The AI took too long to respond (60s)."
    }
};

export class AIService {

    private static readonly FREE_MODELS = [
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "mistralai/mistral-7b-instruct:free",
        "meta-llama/llama-3.2-1b-instruct:free",
    ];

    private static readonly PROVIDER_MODELS: Record<string, string> = {
        openrouter: "google/gemini-2.0-flash-001",
        gemini: "google/gemini-pro",
        gpt: "openai/gpt-3.5-turbo",
    };

    public static async analyze(prompt: string, language: string, passedApiKey?: string): Promise<CodeAnalysisResult> {
        const config = vscode.workspace.getConfiguration('contrarianCoder');
        const provider = config.get<string>('aiProvider', 'openrouter');
        let apiKey = passedApiKey || config.get<string>('aiApiKey', '');
        const trans = aiTranslations[language] || aiTranslations.es;
        
        let model = AIService.PROVIDER_MODELS[provider] || AIService.PROVIDER_MODELS.openrouter;

        if (!apiKey) {
            model = AIService.FREE_MODELS[Math.floor(Math.random() * AIService.FREE_MODELS.length)];
            apiKey = config.get<string>('openRouterKey', ''); 
            if (!apiKey && provider !== 'openrouter') {
                return { error: trans.errorKey };
            }
        }

        return AIService._makeRequest(prompt, model, apiKey, language);
    }

    private static _makeRequest(prompt: string, model: string, apiKey: string, language: string): Promise<CodeAnalysisResult> {
        const trans = aiTranslations[language] || aiTranslations.es;
        return new Promise((resolve) => {
            const postData = JSON.stringify({
                model,
                messages: [{ role: "user", content: prompt }]
            });

            const options: https.RequestOptions = {
                hostname: 'openrouter.ai',
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://github.com/contrarian-coder',
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'identity',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                    try {
                        const data = JSON.parse(rawData);
                        if (data.error) {
                            console.error('[AIService] API error:', JSON.stringify(data.error));
                            resolve({ error: `${trans.errorAPI}${data.error.message || 'Error'}` });
                            return;
                        }
                        const content = data.choices?.[0]?.message?.content;
                        if (!content) {
                            resolve({ error: trans.errorNoContent });
                            return;
                        }
                        
                        const jsonStart = content.indexOf('{');
                        const jsonEnd = content.lastIndexOf('}');
                        if (jsonStart === -1 || jsonEnd === -1) {
                            resolve({ error: trans.errorInvalidJSON });
                            return;
                        }
                        const jsonStr = content.substring(jsonStart, jsonEnd + 1);
                        resolve(JSON.parse(jsonStr));
                    } catch (e) {
                        console.error('[AIService] Parse error:', e);
                        resolve({ error: trans.errorRead });
                    }
                });
            });

            req.on('error', (e: Error) => {
                console.error('[AIService] Connection error:', e.message);
                resolve({ error: `${trans.errorConn}${e.message}` });
            });

            req.setTimeout(60000, () => {
                req.destroy();
                resolve({ error: trans.errorTimeout });
            });

            req.write(postData);
            req.end();
        });
    }
}
