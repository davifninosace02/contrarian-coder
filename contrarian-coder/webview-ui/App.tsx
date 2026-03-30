import React, { useState, useEffect } from 'react';
import './App.css';

interface ProposedApproach {
    title: string;
    description: string;
    code: string;
    potentialErrors: string[];
}

interface CodeImprovement {
    title: string;
    description: string;
    priority: 'alta' | 'media' | 'baja';
    code?: string;
}

interface CodeAnalysisResult {
    originalCode?: string;
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

declare function acquireVsCodeApi(): any;

const vscode = acquireVsCodeApi();

const PRIORITY_EMOJI: Record<string, string> = {
    alta: '🔴',
    media: '🟡',
    baja: '🟢',
};

const App = () => {
    const [fastAnalysis, setFastAnalysis] = useState<CodeAnalysisResult | null>(null);
    const [slowAnalysis, setSlowAnalysis] = useState<CodeAnalysisResult | null>(null);
    const [loadingFast, setLoadingFast] = useState(false);
    const [loadingSlow, setLoadingSlow] = useState(false);
    const [userIntent, setUserIntent] = useState('');

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'fastResult':
                    setFastAnalysis(message.analysis);
                    break;
                case 'slowResult':
                    setSlowAnalysis(message.analysis);
                    break;
                case 'loadingFast':
                    setLoadingFast(message.value);
                    break;
                case 'loadingSlow':
                    setLoadingSlow(message.value);
                    break;
                case 'noResults':
                    setSlowAnalysis({ error: "No hay resultados para este código." });
                    break;
                case 'clear':
                    setFastAnalysis(null);
                    setSlowAnalysis(null);
                    break;
            }
        };

        window.addEventListener('message', handler);
        vscode.postMessage({ type: 'ready' });

        return () => window.removeEventListener('message', handler);
    }, []);

    const handleConsultPlan = () => {
        vscode.postMessage({ type: 'updateIntent', intent: userIntent });
    };

    const renderApproaches = (approaches: ProposedApproach[]) => {
        if (!approaches || approaches.length === 0) return null;

        return (
            <section className="approaches-section">
                <h3>🚀 Dos Caminos para tu Plan</h3>
                <div className="approaches-list">
                    {approaches.map((app, i) => (
                        <div key={i} className="approach-card">
                            <div className="approach-header">
                                <span className="approach-number">Camino {i + 1}</span>
                                <strong className="approach-title">{app.title}</strong>
                            </div>
                            <p className="approach-desc">{app.description}</p>
                            {app.code && (
                                <pre className="approach-code"><code>{app.code}</code></pre>
                            )}
                            <div className="approach-errors">
                                <strong>⚠️ Posibles Errores:</strong>
                                <ul>
                                    {app.potentialErrors.map((err, j) => <li key={j}>{err}</li>)}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    };

    const renderImprovements = (improvements: CodeImprovement[]) => {
        if (!improvements || improvements.length === 0) return null;

        return (
            <section className="improvements-section">
                <h3>💡 Mejoras Sugeridas</h3>
                <div className="improvements-list">
                    {improvements.map((imp, i) => (
                        <div key={i} className={`improvement-card priority-${imp.priority}`}>
                            <div className="improvement-header">
                                <span className="priority-badge">
                                    {PRIORITY_EMOJI[imp.priority] || '🟡'} {imp.priority.toUpperCase()}
                                </span>
                                <strong className="improvement-title">{imp.title}</strong>
                            </div>
                            <p className="improvement-desc">{imp.description}</p>
                            {imp.code && (
                                <pre className="improvement-code"><code>{imp.code}</code></pre>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        );
    };

    const renderAnalysisCard = (res: CodeAnalysisResult) => {
        if (res.error) {
            return <div className="error-message">{res.error}</div>;
        }

        return (
            <div className={`analysis-result ${res.isFast ? 'fast-result' : 'slow-result'}`}>
                <div className="result-badge">
                    {res.isFast ? '⚡ Análisis Rápido' : '🧠 Análisis Completo'}
                </div>

                {/* Planes de Usuario — Prioridad Máxima */}
                {renderApproaches(res.approaches || [])}

                {/* Mejoras sugeridas */}
                {renderImprovements(res.improvements || [])}

                <section>
                    <h3>La Manera Contraria</h3>
                    <pre><code>{res.contrarianWay}</code></pre>
                </section>
                
                <div className="analysis-grid">
                    <section className="errors original-errors">
                        <h3>Errores en tu Código</h3>
                        {(res.originalErrors || []).length > 0 ? (
                            <ul>{res.originalErrors!.map((err, i) => <li key={i}>{err}</li>)}</ul>
                        ) : (
                            <p className="no-errors">¡No se detectaron errores críticos!</p>
                        )}
                    </section>

                    <section className="errors contrarian-errors">
                        <h3>Avisos en la Propuesta</h3>
                        {(res.contrarianErrors || []).length > 0 ? (
                            <ul>{res.contrarianErrors!.map((err, i) => <li key={i}>{err}</li>)}</ul>
                        ) : (
                            <p className="no-errors">Sin avisos relevantes.</p>
                        )}
                    </section>

                    <section className="advantages-section">
                        <h3>Ventajas y Desventajas</h3>
                        <div className="pros">
                            <strong>✅ Ventajas:</strong>
                            <ul>{(res.advantages || []).map((adv, i) => <li key={i}>{adv}</li>)}</ul>
                        </div>
                        <div className="cons">
                            <strong>❌ Desventajas:</strong>
                            <ul>{(res.disadvantages || []).map((dis, i) => <li key={i}>{dis}</li>)}</ul>
                        </div>
                    </section>
                </div>
            </div>
        );
    };

    const currentAnalysis = slowAnalysis || fastAnalysis;
    const totalErrors = (currentAnalysis?.originalErrors || []).length + (currentAnalysis?.contrarianErrors || []).length;
    const totalAdvantages = (currentAnalysis?.advantages || []).length;
    const totalImprovements = (currentAnalysis?.improvements || []).length;
    const hasResults = currentAnalysis && !currentAnalysis.error;

    return (
        <div className="container">
            <header>
                <h1>Contrarian<span>Coder</span></h1>
                <p>Tu perspectiva contraria en tiempo real.</p>
            </header>

            <div className="intent-area">
                <textarea 
                    placeholder="¿Qué vas a hacer? (ej: crear un login)"
                    value={userIntent}
                    onChange={(e) => setUserIntent(e.target.value)}
                    rows={2}
                />
                <button 
                    onClick={handleConsultPlan}
                    className="consult-btn"
                    disabled={loadingFast || loadingSlow}
                >
                    {loadingFast || loadingSlow ? 'Consultando...' : '🚀 Consultar Plan'}
                </button>
            </div>

            <div className="loaders">
                {loadingFast && <div className="loader fast-loader">⚡ IA Rápida analizando...</div>}
                {loadingSlow && <div className="loader slow-loader">🧠 IA Detallada analizando...</div>}
            </div>

            <div className="results-container">
                {fastAnalysis && !slowAnalysis && renderAnalysisCard(fastAnalysis)}
                {slowAnalysis && renderAnalysisCard(slowAnalysis)}
                {!fastAnalysis && !slowAnalysis && !loadingFast && !loadingSlow && (
                    <div className="empty-state">
                        ✏️ Escribe un plan o mejora el código actual.
                    </div>
                )}
            </div>

            {hasResults && (
                <footer className="stats-footer">
                    <div className="stat-item stat-improvements">
                        <span className="stat-number">{totalImprovements}</span>
                        <span className="stat-label">Mejoras</span>
                    </div>
                    <div className="stat-item stat-errors">
                        <span className="stat-number">{totalErrors}</span>
                        <span className="stat-label">Errores</span>
                    </div>
                    <div className="stat-item stat-pros">
                        <span className="stat-number">{totalAdvantages}</span>
                        <span className="stat-label">Ventajas</span>
                    </div>
                    <div className="stat-item stat-type">
                        <span className="stat-number">{currentAnalysis?.isFast ? '⚡' : '🧠'}</span>
                        <span className="stat-label">{currentAnalysis?.isFast ? 'Rápido' : 'Completo'}</span>
                    </div>
                </footer>
            )}
        </div>
    );
};

export default App;
