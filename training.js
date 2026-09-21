(function () {
    const KEY = 'siga-treinamentos';
    const MODULE_KEY = 'siga-treinamento-modulos';
    const progressKey = () => `${KEY}-progresso::${window.effectiveUserId?.() || 'anon'}`;
    const read = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
    const write = (key, value) => { const previous = read(key); localStorage.setItem(key, JSON.stringify(value)); if ((key === KEY || key === MODULE_KEY) && Array.isArray(value)) { const removedIds = Array.isArray(previous) ? previous.filter(item => !value.some(next => next.id === item.id)).map(item => item.id) : []; window.syncStoredList?.(key, value, removedIds); } };
    const session = () => window.getSession?.() || {};
    const users = () => window.getUsuarios?.() || [];
    const today = () => new Date().toISOString().slice(0, 10);
    const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const youtubeId = url => String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/i)?.[1] || '';
    const mediaUrl = url => { const id = youtubeId(url); return id ? `https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}&rel=0&controls=1&modestbranding=1&playsinline=1` : ''; };
    const progress = () => { try { return JSON.parse(localStorage.getItem(progressKey())) || {}; } catch { return {}; } };
    const saveProgress = value => write(progressKey(), value);
    const normalizeQuestions = raw => { const source = Array.isArray(raw) ? raw : raw?.questions || []; return source.map(item => ({ question: String(item.question || '').trim(), options: (item.options || []).map(String).filter(Boolean).slice(0, 4), correct: 0 })).filter(item => item.question && item.options.length >= 2); };
    const trainings = () => read(KEY).map(item => ({ ...item, moduleId: item.moduleId || 'general', questions: normalizeQuestions(item.questions || []) }));
    const modules = () => { const stored = read(MODULE_KEY); return [...stored, ...(stored.some(item => item.id === 'general') ? [] : [{ id: 'general', title: 'Geral', order: 0, lojaId: session().lojaId }])]; };
    const stateFor = (item, data = progress()) => data[item.id] || { mediaContent: {}, index: 0, score: 0, errors: 0, order: item.questions.map((_, index) => index).sort(() => Math.random() - 0.5), answers: {} };
    const mediaDone = state => state.media || Object.values(state.mediaContent || {}).some(Boolean);
    const available = item => { const availability = item.availability || { mode: 'all', values: [] }; if (availability.mode === 'all') return true; if (availability.mode === 'dates') return availability.values.includes(today()); return availability.values.includes(String(new Date().getDay())); };

    let globalShowPage = null;

    if (!window.siteConfirm) {
        window.siteConfirm = async message => {
            if (typeof window.confirm === 'function') return window.confirm(message);
            return true;
        };
    }

    function hideTrainingPages() { document.querySelectorAll('#training-page, #manager-training-page').forEach(page => page.classList.add('hidden')); }
    
    function updateTrainingNavigation() { 
        const indicator = document.getElementById('nav-indicator'); 
        const buttons = [...document.querySelectorAll('#mobile-navigation > button')]; 
        const trainingButton = document.getElementById('nav-training'); 
        if (!indicator || !trainingButton || !buttons.length) return; 
        const index = buttons.indexOf(trainingButton); 
        const width = 100 / buttons.length; 
        indicator.style.width = `${width}%`; 
        indicator.style.left = `${index * width}%`; 
        buttons.forEach(button => button.classList.toggle('bg-indigo-50', button === trainingButton)); 
    }
    
    function openPage(pageId) { 
        if (globalShowPage) globalShowPage(pageId === 'training-page' ? 'training' : 'dashboard'); 
        document.querySelectorAll('main, section[id$="-page"]').forEach(element => element.classList.add('hidden')); 
        document.getElementById(pageId)?.classList.remove('hidden'); 
        const fabButton = document.getElementById('fab-button');
        if (fabButton) fabButton.classList.toggle('hidden', pageId === 'training-page' || pageId === 'manager-training-page');
        if (pageId === 'training-page') updateTrainingNavigation(); 
    }

    function buildShell() {
        if (document.getElementById('training-page')) return;
        const nav = document.getElementById('mobile-navigation');
        const button = document.createElement('button'); 
        button.id = 'nav-training'; 
        button.type = 'button'; 
        button.className = 'relative z-10 flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-slate-300'; 
        button.innerHTML = '<i data-lucide="graduation-cap" class="h-6 w-6"></i><span class="text-[9px] font-black uppercase tracking-widest">Treino</span>'; 
        nav?.appendChild(button);
        button.addEventListener('click', () => { document.getElementById('fab-button')?.classList.add('hidden'); openPage('training-page'); renderList(); renderTrainingRanking('day'); });
        
        document.getElementById('app-shell').insertAdjacentHTML('beforeend', `
            <section id="training-page" class="hidden mx-auto w-[min(100%-2rem,64rem)] space-y-6 p-4">
                <div class="flex items-center gap-3"><button type="button" data-back-dashboard aria-label="Voltar ao início" class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><i data-lucide="arrow-left" class="h-4 w-4"></i></button><div><h2 class="text-2xl font-black text-slate-800">Treinamentos</h2><p class="mt-1 text-xs font-medium text-slate-500">Conclua um conteúdo de cada treinamento para liberar a enquete.</p></div></div>
                <div id="training-list" class="space-y-4"></div>
                <section id="training-player" class="hidden rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p id="training-status" class="text-[10px] font-black uppercase tracking-wider text-rose-600"></p>
                            <h3 id="training-title-view" class="mt-1 text-xl font-black text-slate-800"></h3>
                        </div>
                        <button id="training-close" type="button" class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500" aria-label="Fechar"><i data-lucide="x" class="h-4 w-4"></i></button>
                    </div>
                    <div id="training-video" class="mt-5 overflow-hidden rounded-2xl bg-slate-950"></div>
                    <div id="training-audio" class="mt-3"></div>
                    <details id="training-pdf" class="mt-3 hidden rounded-2xl border border-slate-100 bg-slate-50">
                        <summary class="cursor-pointer px-4 py-3 text-xs font-black text-slate-700">Material em PDF</summary>
                        <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
                            <button id="training-pdf-prev" type="button" class="rounded-lg bg-white px-3 py-2 text-xs font-black">Anterior</button>
                            <button id="training-pdf-next" type="button" class="rounded-lg bg-white px-3 py-2 text-xs font-black">Próxima</button>
                            <button id="training-pdf-zoom-out" type="button" class="rounded-lg bg-white px-3 py-2 text-xs font-black">-</button>
                            <span id="training-pdf-page" class="text-xs font-bold text-slate-500"></span>
                            <button id="training-pdf-zoom-in" type="button" class="rounded-lg bg-white px-3 py-2 text-xs font-black">+</button>
                            <button id="training-pdf-done" type="button" class="ml-auto rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Concluir leitura</button>
                        </div>
                        <div id="training-pdf-viewer" class="max-h-[70vh] overflow-auto bg-slate-200 p-3 text-center"><canvas id="training-pdf-canvas" class="mx-auto"></canvas></div>
                    </details>
                    <div id="training-quiz" class="mt-5"></div>
                </section>
                <section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                    <div class="flex items-center justify-between"><h3 class="text-sm font-black uppercase tracking-wider text-slate-800">Ranking de acertos</h3><div class="flex rounded-xl bg-slate-100 p-1"><button data-ranking="day" class="training-period rounded-lg bg-white px-3 py-2 text-[10px] font-black text-rose-600 shadow-sm">Hoje</button><button data-ranking="week" class="training-period rounded-lg px-3 py-2 text-[10px] font-black text-slate-500">Semana</button><button data-ranking="month" class="training-period rounded-lg px-3 py-2 text-[10px] font-black text-slate-500">Mês</button></div></div>
                    <div id="training-ranking" class="mt-6"></div>
                </section>
            </section>
            <section id="manager-training-page" class="hidden mx-auto w-[min(100%-2rem,64rem)] space-y-6 p-4">
                <div class="flex items-center gap-3"><button type="button" data-back-dashboard aria-label="Voltar ao início" class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><i data-lucide="arrow-left" class="h-4 w-4"></i></button><div><h2 class="text-2xl font-black text-slate-800">Gestão de treinamentos</h2><p class="mt-1 text-xs font-medium text-slate-500">Organize módulos e publique os conteúdos da equipe.</p></div></div>
                <form id="module-form" class="flex gap-2 rounded-[2rem] border border-slate-100 bg-white p-5"><input id="module-title" required placeholder="Nome do módulo" class="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><button type="submit" class="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-black text-white">Adicionar módulo</button></form>
                <form id="training-form" class="grid gap-3 rounded-[2rem] border border-slate-100 bg-white p-5">
                    <input type="hidden" id="training-editing-id">
                    <select id="training-module" required class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"></select>
                    <input id="training-title" required placeholder="Título do treinamento" class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <input id="training-video-url" placeholder="Link do vídeo no YouTube" class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <input id="training-audio-url" placeholder="Link do áudio ou arquivo de áudio" class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <input id="training-pdf-url" placeholder="Link do PDF (opcional)" class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <div class="grid gap-3 sm:grid-cols-2">
                        <select id="training-availability-mode" class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">Todos os dias</option><option value="dates">Datas específicas</option><option value="weekdays">Dias da semana</option></select>
                        <input id="training-available-values" placeholder="2026-09-22 ou 1,3,5" class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    </div>
                    <div><p class="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Vendedores</p><div id="training-vendors" class="grid gap-2 sm:grid-cols-2"></div></div>
                    <textarea id="training-questions-json" rows="6" placeholder='[{"question":"Pergunta?","options":["Resposta correta","Outra opção"]}]' class="rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs"></textarea>
                    <div class="flex flex-wrap justify-end gap-2"><button id="training-cancel-edit" type="button" class="hidden rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-500">Cancelar</button><button type="submit" class="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-black text-white">Salvar treinamento</button></div>
                    <p id="training-feedback" class="text-center text-[10px] font-bold text-rose-600"></p>
                </form>
                <div id="manager-training-list" class="space-y-3"></div>
            </section>
        `);
        const desktop = document.querySelector('#desktop-navigation > div');
        const desktopButton = document.createElement('button'); desktopButton.type = 'button'; desktopButton.dataset.desktopPage = 'training'; desktopButton.className = 'desktop-nav-button rounded-xl px-3 py-2 text-xs font-black text-slate-500'; desktopButton.innerHTML = '<i data-lucide="graduation-cap" class="mr-1 inline h-4 w-4"></i>Treinamento'; desktop?.appendChild(desktopButton);
        desktopButton.addEventListener('click', () => { document.getElementById('fab-button')?.classList.add('hidden'); openPage('training-page'); renderList(); renderTrainingRanking('day'); });
        const managerButton = document.createElement('button'); managerButton.id = 'manager-training-button'; managerButton.type = 'button'; managerButton.className = 'rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-black text-white'; managerButton.textContent = 'Treinamentos'; document.querySelector('#manager-bar > div > div:last-child')?.appendChild(managerButton);
        
        window.lucide?.createIcons();
        const trainingPage = document.getElementById('training-page');
        const managerTrainingPage = document.getElementById('manager-training-page');
        [trainingPage, managerTrainingPage].filter(Boolean).forEach(page => {
            page.style.width = 'min(100%, 64rem)';
            page.style.maxWidth = '64rem';
            page.style.margin = '0 auto';
            page.style.paddingLeft = '0';
            page.style.paddingRight = '0';
        });
        const openSeller = () => { document.getElementById('fab-button')?.classList.add('hidden'); openPage('training-page'); renderList(); renderTrainingRanking('day'); };
        button.onclick = openSeller; desktopButton.onclick = openSeller; managerButton.onclick = () => { document.getElementById('fab-button')?.classList.add('hidden'); openPage('manager-training-page'); renderManager(); };
        setTimeout(() => {
            document.querySelectorAll('[data-back-dashboard]').forEach(button => {
                if (button.dataset.bound === 'true') return;
                button.dataset.bound = 'true';
                button.addEventListener('click', () => window.showPage?.('dashboard'));
            });
        }, 0);
    }

    function enhanceTrainingForm() {
        const form = document.getElementById('training-form');
        const pdfUrl = document.getElementById('training-pdf-url');
        const values = document.getElementById('training-available-values');
        const mode = document.getElementById('training-availability-mode');
        const questions = document.getElementById('training-questions-json');
        if (!form || form.dataset.enhanced) return;
        form.dataset.enhanced = 'true';
        pdfUrl.classList.add('hidden');
        pdfUrl.insertAdjacentHTML('beforebegin', '<label class="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-500">Arquivo PDF<input id="training-pdf-file" type="file" accept="application/pdf" class="mt-2 block w-full text-xs"></label>');
        mode.classList.add('hidden');
        values.classList.add('hidden');
        values.insertAdjacentHTML('beforebegin', '<div class="rounded-xl border border-slate-200 p-3"><p class="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Dias disponíveis</p><div class="flex gap-2"><input id="training-availability-month" type="month" class="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"><input id="training-availability-date" type="date" class="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"><button id="training-add-date" type="button" class="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black">Adicionar</button></div><div id="training-weekdays" class="mt-2 grid grid-cols-7 gap-1"></div><label class="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600"><input id="training-all-days" type="checkbox" checked class="h-4 w-4 rounded border-slate-300 text-rose-600"> Todos os dias</label><div id="training-dates" class="mt-2 flex flex-wrap gap-1"></div></div>');
        questions.classList.add('hidden');
        questions.insertAdjacentHTML('beforebegin', '<div class="rounded-xl border border-slate-200 p-3"><div class="flex items-center justify-between"><p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Perguntas</p><button id="training-add-question" type="button" class="rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-600">Adicionar pergunta</button></div><div id="training-manual-questions" class="mt-3 space-y-3"></div></div>');
        const dates = new Set();
        document.getElementById('training-weekdays').innerHTML = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => `<button type="button" data-training-weekday="${index}" class="rounded-lg border border-slate-200 bg-slate-50 px-1 py-2 text-[9px] font-black text-slate-500">${day}</button>`).join('');
        const renderDates = () => { document.getElementById('training-dates').innerHTML = [...dates].sort().map(date => `<button type="button" data-remove-training-date="${date}" class="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-bold text-rose-700">${date.split('-').reverse().join('/')} ×</button>`).join(''); values.value = [...dates].sort().join(','); };
        document.getElementById('training-add-date').onclick = () => { const date = document.getElementById('training-availability-date').value; if (!date) return; dates.add(date); document.getElementById('training-all-days').checked = false; document.getElementById('training-availability-mode').value = 'dates'; document.getElementById('training-availability-date').value = ''; renderDates(); };
        document.getElementById('training-dates').onclick = event => { const button = event.target.closest('[data-remove-training-date]'); if (button) { dates.delete(button.dataset.removeTrainingDate); renderDates(); } };
        document.getElementById('training-weekdays').onclick = event => { const button = event.target.closest('[data-training-weekday]'); if (!button) return; button.classList.toggle('border-rose-500'); button.classList.toggle('bg-rose-500'); button.classList.toggle('text-white'); document.getElementById('training-all-days').checked = false; document.getElementById('training-availability-mode').value = 'weekdays'; values.value = [...document.querySelectorAll('[data-training-weekday].bg-rose-500')].map(item => item.dataset.trainingWeekday).join(','); };
        document.getElementById('training-all-days').onchange = event => { if (event.target.checked) { dates.clear(); document.querySelectorAll('[data-training-weekday]').forEach(button => button.className = 'rounded-lg border border-slate-200 bg-slate-50 px-1 py-2 text-[9px] font-black text-slate-500'); document.getElementById('training-availability-mode').value = 'all'; values.value = ''; renderDates(); } };
        const renderQuestions = () => { const rows = [...document.querySelectorAll('#training-manual-questions > div')]; questions.value = JSON.stringify(rows.map(row => ({ question: row.querySelector('[data-manual-question]').value.trim(), options: [...row.querySelectorAll('[data-manual-option]')].map(input => input.value.trim()).filter(Boolean) })).filter(item => item.question && item.options.length >= 2)); };
        document.getElementById('training-add-question').onclick = () => { const row = document.createElement('div'); row.className = 'rounded-xl bg-slate-50 p-3'; row.innerHTML = '<input data-manual-question placeholder="Pergunta" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"><div class="mt-2 grid gap-2 sm:grid-cols-2"><input data-manual-option placeholder="Resposta correta" class="rounded-lg border border-slate-200 px-3 py-2 text-xs"><input data-manual-option placeholder="Opção 2" class="rounded-lg border border-slate-200 px-3 py-2 text-xs"><input data-manual-option placeholder="Opção 3" class="rounded-lg border border-slate-200 px-3 py-2 text-xs"><input data-manual-option placeholder="Opção 4" class="rounded-lg border border-slate-200 px-3 py-2 text-xs"></div>'; row.addEventListener('input', renderQuestions); document.getElementById('training-manual-questions').appendChild(row); renderQuestions(); };
        document.getElementById('training-pdf-file').onchange = event => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { pdfUrl.value = reader.result; }; reader.readAsDataURL(file); };
    }

    function renderList() {
        const target = document.getElementById('training-list'); if (!target) return;
        const data = progress(); const sellerId = window.effectiveUserId?.(); const visible = trainings().filter(item => item.lojaId === session().lojaId && (item.vendorIds || []).includes(sellerId) && available(item));
        const grouped = modules().filter(module => module.lojaId === session().lojaId || module.id === 'general').sort((a, b) => (a.order || 0) - (b.order || 0)).map(module => ({ module, items: visible.filter(item => item.moduleId === module.id) })).filter(group => group.items.length);
        target.innerHTML = grouped.length ? grouped.map(group => { const complete = group.items.every(item => stateFor(item, data).completed); return `<section class="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm"><div class="mb-4 flex items-center justify-between"><div><p class="text-[10px] font-black uppercase tracking-wider text-rose-600">Módulo</p><h3 class="text-lg font-black text-slate-800">${esc(group.module.title)}</h3></div><span class="rounded-full ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'} px-3 py-1 text-[10px] font-black">${complete ? 'Módulo completo' : `${group.items.filter(item => stateFor(item, data).completed).length}/${group.items.length}`}</span></div><div class="space-y-3">${group.items.map(item => { const state = stateFor(item, data); const done = state.completed; return `<article class="rounded-2xl border ${done ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'} p-4"><div class="flex items-start justify-between"><div><p class="text-[10px] font-black uppercase tracking-wider ${done ? 'text-emerald-600' : 'text-rose-600'}">${done ? 'Concluído' : mediaDone(state) ? 'Em andamento' : 'Disponível'}</p><h4 class="mt-1 text-sm font-black text-slate-800">${esc(item.title)}</h4><p class="mt-2 text-[10px] text-slate-500">${item.videoUrl ? 'Vídeo · ' : ''}${item.audioUrl ? 'Áudio · ' : ''}${item.pdfUrl ? 'PDF · ' : ''}${item.questions.length} perguntas</p></div><i data-lucide="${done ? 'badge-check' : 'graduation-cap'}" class="h-5 w-5 ${done ? 'text-emerald-500' : 'text-rose-500'}"></i></div><button data-open-training="${item.id}" class="mt-3 w-full rounded-xl ${done ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-600 text-white'} px-4 py-2.5 text-xs font-black">${done ? 'Ver resultado' : mediaDone(state) ? 'Continuar treinamento' : 'Começar treinamento'}</button></article>`; }).join('')}</div></section>`; }).join('') : '<p class="rounded-2xl bg-white p-5 text-xs text-slate-400">Nenhum treinamento disponível hoje.</p>'; window.lucide?.createIcons();
    }

    function renderQuestion(training, state) { const target = document.getElementById('training-quiz'); if (state.completed) { target.innerHTML = `<div class="rounded-2xl bg-emerald-50 p-4 text-center"><p class="text-sm font-black text-emerald-700">Teste concluído</p><p class="mt-2 text-xs font-bold text-emerald-700">${state.score || 0} acertos · ${state.errors || 0} erros</p></div>`; return; } const question = training.questions[state.order[state.index]]; if (!question) { state.completed = true; state.completedAt = new Date().toISOString(); saveProgress({ ...progress(), [training.id]: state }); renderQuestion(training, state); renderList(); return; } const options = state.options || (state.options = {}); options[state.index] ||= question.options.map((text, index) => ({ text, correct: index === 0 })).sort(() => Math.random() - 0.5); saveProgress({ ...progress(), [training.id]: state }); const choices = options[state.index]; const answer = state.answers[state.index]; target.innerHTML = `<div class="border-t border-slate-100 pt-5"><p class="text-[10px] font-black uppercase text-rose-600">Pergunta ${state.index + 1} de ${training.questions.length}</p><h4 class="mt-2 text-base font-black text-slate-800">${esc(question.question)}</h4><div class="mt-4 space-y-2">${choices.map((choice, index) => `<button type="button" data-training-choice="${index}" ${answer ? 'disabled' : ''} class="w-full rounded-xl border px-3 py-3 text-left text-xs font-bold ${answer?.selected === index ? (answer.correct ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50') : 'border-slate-200 bg-white'}">${esc(choice.text)}</button>`).join('')}</div>${answer ? `<p class="mt-3 rounded-xl p-3 text-xs font-bold ${answer.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${answer.correct ? 'Parabéns, resposta correta!' : `Resposta certa: ${esc(choices.find(choice => choice.correct)?.text)}`}</p><button type="button" id="training-next" class="mt-3 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white">${state.index + 1 === training.questions.length ? 'Finalizar' : 'Avançar'}</button>` : '<p class="mt-3 text-[10px] font-semibold text-slate-400">Escolha uma alternativa para confirmar.</p>'}</div>`; bindQuizInteractions(); }

    function markMediaComplete(id, type) { const item = trainings().find(training => training.id === id); if (!item) return; const data = progress(); const state = stateFor(item, data); state.mediaContent ||= {}; state.mediaContent[type] = true; state.media = true; data[id] = state; saveProgress(data); openTraining(id); }

    let pdfDocument = null;
    let pdfPageNumber = 1;
    let pdfScale = 1.1;
    let activePdfTrainingId = '';

    async function renderPdfPage() {
        if (!pdfDocument) return;
        const page = await pdfDocument.getPage(pdfPageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const viewerWidth = document.getElementById('training-pdf-viewer')?.clientWidth || baseViewport.width;
        const fitScale = Math.max(0.1, (viewerWidth - 24) / baseViewport.width);
        const viewport = page.getViewport({ scale: fitScale * pdfScale });
        const canvas = document.getElementById('training-pdf-canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        document.getElementById('training-pdf-page').textContent = `Página ${pdfPageNumber} de ${pdfDocument.numPages}`;
        if (pdfPageNumber === pdfDocument.numPages) {
            const state = progress()[activePdfTrainingId];
            if (!state?.mediaContent?.pdf) markMediaComplete(activePdfTrainingId, 'pdf');
        }
    }

    async function openPdfViewer(training) {
        activePdfTrainingId = training.id;
        const pdf = document.getElementById('training-pdf');
        pdf.classList.toggle('hidden', !training.pdfUrl);
        if (!training.pdfUrl) return;
        pdf.open = true;
        const pdfToolbar = pdf.querySelector('div.border-b');
        if (pdfToolbar) { pdfToolbar.style.display = 'flex'; pdfToolbar.style.flexWrap = 'nowrap'; pdfToolbar.style.alignItems = 'center'; pdfToolbar.style.gap = '0.5rem'; }
        try {
            const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
            const bytes = new Uint8Array(await (await fetch(training.pdfUrl)).arrayBuffer());
            pdfDocument = await pdfjs.getDocument({ data: bytes }).promise;
            pdfPageNumber = 1;
            pdfScale = 1;
            await renderPdfPage();
        } catch (error) {
            document.getElementById('training-pdf-page').textContent = 'Não foi possível carregar o PDF.';
            console.warn('Falha ao abrir PDF:', error);
        }
    }

    function bindPdfControls() {
        document.getElementById('training-pdf-prev').onclick = () => { if (pdfDocument && pdfPageNumber > 1) { pdfPageNumber--; renderPdfPage(); } };
        document.getElementById('training-pdf-next').onclick = () => { if (pdfDocument && pdfPageNumber < pdfDocument.numPages) { pdfPageNumber++; renderPdfPage(); } };
        document.getElementById('training-pdf-zoom-in').onclick = () => { pdfScale += 0.2; renderPdfPage(); };
        document.getElementById('training-pdf-zoom-out').onclick = () => { pdfScale = Math.max(0.6, pdfScale - 0.2); renderPdfPage(); };
        
        const doneButton = document.getElementById('training-pdf-done');
        if (doneButton) doneButton.onclick = () => markMediaComplete(activePdfTrainingId, 'pdf');

        let pinchStartDistance = 0;
        const viewer = document.getElementById('training-pdf-viewer');
        viewer.ontouchstart = event => { if (event.touches.length === 2) pinchStartDistance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY); };
        viewer.ontouchmove = event => { if (event.touches.length !== 2 || !pinchStartDistance) return; event.preventDefault(); const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY); const ratio = distance / pinchStartDistance; if (Math.abs(ratio - 1) > 0.08) { pdfScale = Math.min(3, Math.max(0.6, pdfScale * ratio)); pinchStartDistance = distance; renderPdfPage(); } };
        viewer.ontouchend = () => { pinchStartDistance = 0; };
    }

    function sendYoutubeCommand(frame, func, args = []) { frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args, id: frame.id, channel: 'widget' }), '*'); }

    function buildYoutubeAudio(url, training) {
        const frame = `<iframe id="training-audio-frame" class="pointer-events-none absolute inset-0 h-full w-full opacity-0" tabindex="-1" title="Áudio" allow="autoplay; encrypted-media" src="${mediaUrl(url)}"></iframe>`;
        return `<div class="relative rounded-2xl border border-slate-100 bg-slate-50 p-3"><div class="flex items-center gap-3"><button id="training-audio-toggle" type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white" aria-label="Reproduzir áudio"><i data-lucide="play" class="h-4 w-4"></i></button><input id="training-audio-progress" type="range" min="0" max="100" value="0" class="w-full accent-rose-600"><span id="training-audio-time" class="text-[10px] font-bold text-slate-400">0:00</span></div>${frame}</div>`;
    }

    function enhanceAudioPlayer(trainingId) {
        const frame = document.getElementById('training-audio-frame');
        const toggle = document.getElementById('training-audio-toggle');
        const progressInput = document.getElementById('training-audio-progress');
        const timeLabel = document.getElementById('training-audio-time');
        if (!frame || !toggle || !progressInput) return;
        let playing = false;
        let current = Number(progressInput.value || 0);
        let lastTick = 0;
        let timer;
        const draw = () => { progressInput.value = current; timeLabel.textContent = `${Math.floor(current / 60)}:${String(Math.floor(current % 60)).padStart(2, '0')}`; };
        const stop = () => { playing = false; cancelAnimationFrame(timer); lastTick = 0; toggle.innerHTML = '<i data-lucide="play" class="h-4 w-4"></i>'; window.lucide?.createIcons(); };
        const tick = timestamp => { if (!playing) return; if (lastTick) current += (timestamp - lastTick) / 1000; lastTick = timestamp; draw(); timer = requestAnimationFrame(tick); };
        toggle.onclick = () => { playing = !playing; sendYoutubeCommand(frame, playing ? 'playVideo' : 'pauseVideo'); toggle.innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}" class="h-4 w-4"></i>`; window.lucide?.createIcons(); lastTick = 0; if (playing) timer = requestAnimationFrame(tick); else cancelAnimationFrame(timer); };
        progressInput.oninput = () => { current = Number(progressInput.value); draw(); sendYoutubeCommand(frame, 'seekTo', [current, true]); };
        window.trainingAudioStop = stop;
        draw();
        window.lucide?.createIcons();
    }

    function openTraining(id) {
        const training = trainings().find(item => item.id === id); if (!training) return;
        const data = progress(); const state = stateFor(training, data); data[id] = state; saveProgress(data);
        document.getElementById('training-player').classList.remove('hidden'); document.getElementById('training-title-view').textContent = training.title; document.getElementById('training-status').textContent = mediaDone(state) ? 'Enquete liberada' : 'Veja pelo menos um conteúdo';
        document.getElementById('training-video').innerHTML = training.videoUrl ? `<iframe id="training-video-frame" class="aspect-video w-full" src="${mediaUrl(training.videoUrl)}" allowfullscreen></iframe>` : '';
        document.getElementById('training-audio').innerHTML = training.audioUrl ? (youtubeId(training.audioUrl) ? buildYoutubeAudio(training.audioUrl, training) : `<audio id="training-audio-player" class="w-full" controls src="${esc(training.audioUrl)}"></audio>`) : '';
        const audioPlayer = document.getElementById('training-audio-player'); if (audioPlayer) audioPlayer.onended = () => markMediaComplete(training.id, 'audio');
        const audioFrame = document.getElementById('training-audio-frame'); const audioToggle = document.getElementById('training-audio-toggle'); const audioProgress = document.getElementById('training-audio-progress');
        if (audioFrame) { const armAudio = () => { audioFrame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: audioFrame.id, channel: 'widget' }), '*'); audioFrame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: audioFrame.id, channel: 'widget' }), '*'); }; audioFrame.addEventListener('load', armAudio); armAudio(); }
        openPdfViewer(training); bindPdfControls(); enhanceAudioPlayer(training.id); window.lucide?.createIcons();
        if (!mediaDone(state)) document.getElementById('training-quiz').innerHTML = '<div class="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">Abra ou assista pelo menos um conteúdo para liberar a enquete.<button id="training-release" type="button" class="mt-3 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white">Liberar enquete</button></div>'; else if (training.questions.length) renderQuestion(training, state); else { state.completed = true; state.completedAt = new Date().toISOString(); saveProgress({ ...progress(), [training.id]: state }); document.getElementById('training-quiz').innerHTML = '<p class="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">Treinamento concluído.</p>'; }
        bindQuizInteractions();
    }

    function renderRanking(period) {
        const target = document.getElementById('training-ranking'); if (!target) return;
        document.querySelectorAll('[data-ranking]').forEach(button => { const active = button.dataset.ranking === period; button.className = `training-period rounded-lg px-3 py-2 text-[10px] font-black ${active ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`; });
        const start = new Date(); if (period === 'day') start.setHours(0, 0, 0, 0); else if (period === 'week') { start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay()); } else { start.setDate(1); start.setHours(0, 0, 0, 0); }
        const rows = users().filter(user => user.lojaId === session().lojaId && user.role === 'vendedor').map(user => { let score = 0; try { Object.values(JSON.parse(localStorage.getItem(`${KEY}-progresso::${user.id}`)) || {}).forEach(item => { if (item.completed && new Date(item.completedAt) >= start) score += Number(item.score || 0); }); } catch {} return { name: user.name, score }; }).sort((a, b) => b.score - a.score);
        const podium = rows.slice(0, 3); const colors = ['bg-amber-400', 'bg-slate-400', 'bg-rose-400'];
        const heights = [96, 72, 56];
        target.innerHTML = podium.length ? `<div class="flex items-end justify-center gap-3">${podium.map((row, index) => `<div class="flex w-1/3 flex-col items-center"><div class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-sm font-black text-rose-600">${index + 1}</div><p class="max-w-full truncate text-center text-[10px] font-black text-slate-600">${esc(row.name)}</p><div class="mt-2 flex w-full items-center justify-center rounded-t-2xl ${colors[index]} text-xl font-black text-white" style="height:${heights[index]}px">${row.score}</div></div>`).join('')}</div>` : '<p class="text-xs text-slate-400">Nenhum resultado ainda.</p>';
    }

    function renderTrainingRanking(period) {
        const target = document.getElementById('training-ranking'); if (!target) return;
        document.querySelectorAll('#training-page [data-ranking]').forEach(button => { const active = button.dataset.ranking === period; button.className = active ? 'training-period rounded-lg bg-white px-3 py-2 text-[10px] font-black text-rose-600 shadow-sm' : 'training-period rounded-lg px-3 py-2 text-[10px] font-black text-slate-500'; });

        const start = new Date();
        if (period === 'day') start.setHours(0, 0, 0, 0);
        else if (period === 'week') { start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1)); }
        else { start.setDate(1); start.setHours(0, 0, 0, 0); }

        const ranking = users()
            .filter(user => user.lojaId === session().lojaId && user.role === 'vendedor')
            .map(user => {
                let total = 0;
                try {
                    const saved = JSON.parse(localStorage.getItem(`${KEY}-progresso::${user.id}`)) || {};
                    total = Object.values(saved)
                        .filter(item => item.completed && item.completedAt && new Date(item.completedAt) >= start)
                        .reduce((sum, item) => sum + Number(item.score || 0), 0);
                } catch {}
                return { ...user, total: Number(total) || 0 };
            })
            .sort((first, second) => second.total - first.total || String(first.name).localeCompare(String(second.name), 'pt-BR'))
            .slice(0, 3);

        if (!ranking.length) {
            target.innerHTML = '<p class="w-full text-center text-xs font-semibold text-slate-400">Nenhum vendedor cadastrado.</p>';
            return;
        }

        const colors = { 1: ['h-24', 'bg-yellow-400', 'border-yellow-400', 'text-3xl'], 2: ['h-16', 'bg-slate-300', 'border-slate-300', 'text-xl'], 3: ['h-12', 'bg-indigo-600', 'border-indigo-400', 'text-xl'] };
        const podium = ranking.length === 3
            ? [{ seller: ranking[1], position: 2 }, { seller: ranking[0], position: 1 }, { seller: ranking[2], position: 3 }]
            : ranking.length === 2
                ? [{ seller: ranking[1], position: 2 }, { seller: ranking[0], position: 1 }]
                : ranking.map((seller, index) => ({ seller, position: index + 1 }));

        target.innerHTML = `<div class="flex min-h-32 items-end justify-center gap-3">${podium.map(item => {
            const { seller, position } = item;
            const [height, barColor, borderColor, numberSize] = colors[position] || ['h-12', 'bg-indigo-600', 'border-indigo-400', 'text-xl'];
            const avatarSize = position === 1 ? 'h-14 w-14' : 'h-10 w-10';
            const crown = position === 1 ? '<i data-lucide="crown" class="absolute -top-4 left-1/2 h-5 w-5 -translate-x-1/2 text-yellow-500"></i>' : '';
            return `<div class="flex min-w-0 flex-1 flex-col items-center"><div class="relative"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=6366f1&color=fff" alt="${esc(seller.name)}" class="${avatarSize} mb-2 rounded-full border-2 ${borderColor} object-cover shadow-sm">${crown}</div><p class="mb-2 max-w-full truncate text-center text-[10px] font-black text-slate-600">${esc(seller.name)}</p><div class="mb-1 text-[10px] font-black text-rose-600">${seller.total} acertos</div><div class="${height} flex w-full items-center justify-center rounded-t-2xl ${barColor} font-black text-white ${numberSize}">${position}</div></div>`;
        }).join('')}</div>`;
        window.lucide?.createIcons();
    }

    function bindQuizInteractions() {
        const quiz = document.getElementById('training-quiz');
        if (!quiz) return;
        const resolveTraining = () => {
            const title = document.getElementById('training-title-view')?.textContent;
            return trainings().find(item => item.title === title) || null;
        };
        quiz.querySelectorAll('[data-training-choice]').forEach(button => {
            button.type = 'button';
            button.onclick = async event => {
                event.preventDefault();
                event.stopPropagation();
                const training = resolveTraining();
                if (!training) return;
                const data = progress();
                const state = data[training.id];
                if (!state || state.answers[state.index]) return;
                const index = Number(button.dataset.trainingChoice);
                const option = state.options?.[state.index]?.[index];
                if (!option) return;
                if (!await window.siteConfirm(`Você escolheu:\n${option.text}\n\nDeseja confirmar esta resposta?`)) return;
                state.answers[state.index] = { selected: index, correct: option.correct };
                option.correct ? state.score++ : state.errors++;
                saveProgress(data);
                renderQuestion(training, state);
            };
        });
        const next = quiz.querySelector('#training-next');
        if (next) {
            next.type = 'button';
            next.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                const training = resolveTraining();
                if (!training) return;
                const data = progress();
                const state = data[training.id];
                if (!state || !state.answers[state.index]) return;
                state.index++;
                saveProgress(data);
                renderQuestion(training, state);
            };
        }
        const release = quiz.querySelector('#training-release');
        if (release) {
            release.type = 'button';
            release.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                const training = resolveTraining();
                if (!training) return;
                const data = progress();
                const state = data[training.id];
                if (!state) return;
                state.media = true;
                state.mediaContent ||= {};
                state.mediaContent.manual = true;
                saveProgress(data);
                renderQuestion(training, state);
            };
        }
    }

    function fillForm(item) { document.getElementById('training-editing-id').value = item.id; document.getElementById('training-module').value = item.moduleId; document.getElementById('training-title').value = item.title; document.getElementById('training-video-url').value = item.videoUrl || ''; document.getElementById('training-audio-url').value = item.audioUrl || ''; document.getElementById('training-pdf-url').value = item.pdfUrl || ''; document.getElementById('training-availability-mode').value = item.availability?.mode || 'all'; document.getElementById('training-available-values').value = (item.availability?.values || []).join(','); document.getElementById('training-questions-json').value = JSON.stringify(item.questions || [], null, 2); document.querySelectorAll('[data-training-vendor]').forEach(input => { input.checked = (item.vendorIds || []).includes(input.value); }); document.getElementById('training-cancel-edit').classList.remove('hidden'); document.getElementById('training-form').scrollIntoView({ behavior: 'smooth' }); }
    function resetForm() { document.getElementById('training-form').reset(); document.getElementById('training-editing-id').value = ''; document.getElementById('training-cancel-edit').classList.add('hidden'); }
    function renderManager() { const lojaId = session().lojaId; const localModules = modules().filter(item => item.lojaId === lojaId || item.id === 'general').sort((a, b) => (a.order || 0) - (b.order || 0)); document.getElementById('training-module').innerHTML = localModules.map(item => `<option value="${item.id}">${esc(item.title)}</option>`).join(''); document.getElementById('training-vendors').innerHTML = users().filter(user => user.lojaId === lojaId && user.role === 'vendedor').map(user => `<label class="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs font-bold text-slate-600"><input type="checkbox" data-training-vendor value="${user.id}">${esc(user.name)}</label>`).join(''); const items = trainings().filter(item => item.lojaId === lojaId); document.getElementById('manager-training-list').innerHTML = localModules.map(module => { const moduleItems = items.filter(item => item.moduleId === module.id); return `<section class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div class="flex items-center justify-between gap-2"><h3 class="text-sm font-black text-slate-800">${esc(module.title)}</h3>${module.id !== 'general' ? `<button data-delete-module="${module.id}" class="text-[10px] font-black text-red-500">Excluir módulo</button>` : ''}</div><div class="mt-3 space-y-2">${moduleItems.map(item => `<article class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><div><p class="text-xs font-black text-slate-700">${esc(item.title)}</p><p class="mt-1 text-[10px] text-slate-400">${item.questions.length} perguntas · ${(item.vendorIds || []).length} vendedor(es)</p></div><div class="flex gap-2"><button data-edit-training="${item.id}" class="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-indigo-600">Editar</button><button data-delete-training="${item.id}" class="rounded-lg bg-red-50 px-3 py-2 text-[10px] font-black text-red-600">Excluir</button></div></article>`).join('') || '<p class="text-xs text-slate-400">Nenhum treinamento neste módulo.</p>'}</div></section>`; }).join('') || '<p class="text-xs text-slate-400">Nenhum módulo criado.</p>'; }

    function bind() { 
        const byId = id => document.getElementById(id); 
        byId('training-close').onclick = () => byId('training-player').classList.add('hidden'); 
        byId('training-list').onclick = event => { const button = event.target.closest('[data-open-training]'); if (button) openTraining(button.dataset.openTraining); }; 
        document.querySelectorAll('#training-page [data-ranking]').forEach(button => button.onclick = () => renderTrainingRanking(button.dataset.ranking)); 
        bindQuizInteractions(); 
        byId('module-form').onsubmit = event => { event.preventDefault(); const title = byId('module-title').value.trim(); if (!title) return; const current = modules(); current.push({ id: crypto.randomUUID(), lojaId: session().lojaId, title, order: current.length }); write(MODULE_KEY, current); event.target.reset(); renderManager(); }; 
        byId('training-form').onsubmit = event => { event.preventDefault(); let questions = []; try { questions = normalizeQuestions(JSON.parse(byId('training-questions-json').value || '[]')); } catch { byId('training-feedback').textContent = 'JSON inválido.'; return; } const current = trainings(); const editingId = byId('training-editing-id').value; const old = current.find(item => item.id === editingId); const item = { id: editingId || crypto.randomUUID(), lojaId: session().lojaId, moduleId: byId('training-module').value, title: byId('training-title').value.trim(), videoUrl: byId('training-video-url').value.trim(), audioUrl: byId('training-audio-url').value.trim(), pdfUrl: byId('training-pdf-url').value.trim(), availability: { mode: byId('training-availability-mode').value, values: byId('training-available-values').value.split(',').map(value => value.trim()).filter(Boolean) }, vendorIds: [...document.querySelectorAll('[data-training-vendor]:checked')].map(input => input.value), questions, createdAt: old?.createdAt || new Date().toISOString() }; write(KEY, editingId ? current.map(training => training.id === editingId ? item : training) : [...current, item]); resetForm(); renderManager(); }; 
        byId('training-cancel-edit').onclick = resetForm; 
        byId('manager-training-list').onclick = event => { const edit = event.target.closest('[data-edit-training]'); if (edit) { const item = trainings().find(training => training.id === edit.dataset.editTraining); if (item) fillForm(item); } const remove = event.target.closest('[data-delete-training]'); if (remove && confirm('Excluir este treinamento?')) { write(KEY, trainings().filter(training => training.id !== remove.dataset.deleteTraining)); renderManager(); } const removeModule = event.target.closest('[data-delete-module]'); if (removeModule && confirm('Excluir o módulo e seus treinamentos?')) { write(MODULE_KEY, modules().filter(module => module.id !== removeModule.dataset.deleteModule)); write(KEY, trainings().filter(training => training.moduleId !== removeModule.dataset.deleteModule)); renderManager(); } }; 
    }

    function init() { 
        if (!document.getElementById('app-shell')) return; 
        buildShell(); 
        enhanceTrainingForm(); 
        globalShowPage = window.showPage; 
        if (globalShowPage && !window.trainingShowPageWrapped) { 
            window.showPage = pageName => { hideTrainingPages(); globalShowPage(pageName); }; 
            window.trainingShowPageWrapped = true; 
            globalShowPage('dashboard'); 
            hideTrainingPages(); 
        } 
        bind(); 
        document.addEventListener('load', event => { const frame = event.target.closest?.('#training-player iframe[src*="youtube.com"]'); if (!frame) return; frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: frame.id, channel: 'widget' }), '*'); frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: frame.id, channel: 'widget' }), '*'); }, true); 
        window.addEventListener('message', event => { if (event.origin !== 'https://www.youtube.com') return; let data; try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; } if (data?.event === 'onStateChange' && data.info === 0) { window.trainingAudioStop?.(); const frame = [...document.querySelectorAll('#training-player iframe')].find(item => item.contentWindow === event.source); const title = document.getElementById('training-title-view')?.textContent; const item = trainings().find(training => training.title === title); if (item && frame) markMediaComplete(item.id, frame.id === 'training-video-frame' ? 'video' : 'audio'); } }); 
        window.lucide?.createIcons(); 
    }

    window.trainingRenderList = renderList;
    window.trainingRenderRanking = renderTrainingRanking;
    
    function recoverTrainingNavigation() {
        const nav = document.getElementById('mobile-navigation');
        if (!nav) return;
        let button = document.getElementById('nav-training');
        if (!button) {
            button = document.createElement('button');
            button.id = 'nav-training';
            button.type = 'button';
            button.className = 'relative z-10 flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-slate-300';
            button.innerHTML = '<i data-lucide="graduation-cap" class="h-6 w-6"></i><span class="text-[9px] font-black uppercase tracking-widest">Treino</span>';
            nav.appendChild(button);
        }
        button.onclick = event => { event.preventDefault(); document.getElementById('fab-button')?.classList.add('hidden'); if (!document.getElementById('training-page')) buildShell(); openPage('training-page'); renderList(); renderTrainingRanking('day'); };
        bindQuizInteractions();
        if (globalShowPage) globalShowPage('dashboard');
        const indicator = document.getElementById('nav-indicator');
        const buttons = [...document.querySelectorAll('#mobile-navigation > button')];
        if (indicator && buttons.length) { indicator.style.width = `${100 / buttons.length}%`; indicator.style.left = '0%'; buttons.forEach(button => button.classList.toggle('bg-indigo-50', button.id === 'nav-inicio')); }
        window.lucide?.createIcons();
    }
    window.recoverTrainingNavigation = recoverTrainingNavigation;
    
    document.addEventListener('click', event => { const button = event.target.closest?.('#training-page [data-ranking]'); if (button) renderTrainingRanking(button.dataset.ranking); });
    
    window.addEventListener('message', event => {
        let data; try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
        if (data?.event !== 'infoDelivery' || data?.id !== 'training-audio-frame') return;
        const progressInput = document.getElementById('training-audio-progress');
        const timeLabel = document.getElementById('training-audio-time');
        const current = Number(data.info?.currentTime || 0); const duration = Number(data.info?.duration || 0);
        if (progressInput && duration) { progressInput.max = duration; progressInput.value = current; }
        if (timeLabel) timeLabel.textContent = `${Math.floor(current / 60)}:${String(Math.floor(current % 60)).padStart(2, '0')}`;
    });
    
    window.addEventListener('load', () => setTimeout(() => { window.trainingKey = KEY; window.trainingList = trainings; window.trainingWrite = write; window.trainingSession = session; window.trainingNormalizeQuestions = normalizeQuestions; window.trainingRenderManager = renderManager; init(); }, 1000));
    window.addEventListener('load', () => setTimeout(() => { try { recoverTrainingNavigation(); } catch (error) { console.error('Falha ao inicializar o botão de treinamento:', error); } }, 1500));
    window.addEventListener('load', () => setTimeout(() => { if (!window.syncStoredList) return; const storedTrainings = read(KEY); const storedModules = read(MODULE_KEY).filter(item => item.id !== 'general'); if (storedTrainings.length) window.syncStoredList(KEY, storedTrainings); if (storedModules.length) window.syncStoredList(MODULE_KEY, storedModules); }, 1200));
})();
