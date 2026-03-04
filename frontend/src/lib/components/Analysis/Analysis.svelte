<script>
    import ResultsVisualization from "../ResultsVisualization/ResultsVisualization.svelte";
    import FormSection from "../FormSection/FormSection.svelte";
    import { setContext } from 'svelte';
    import { topic, text, ownTextSelected, route } from "$lib/shared";

    let resolvedTopic = $state('')
    let error = $state(null);
    let loading = $state(false);
    let tonality = $state('');
    let result = $state(null);
    let newsSelected = $state(false);
    let resultData = $state(null);
    let statusOk =  $state(false);
    
    setContext('analyze', analyze);

    async function analyze(topic, text, $route) {
        loading = true;
        error = null;
        
        try {
            let payload;
            if (ownTextSelected) {
                payload = { topic, text }; 
            } else {
                payload = { topic };
            }
            console.log(payload)
            const res = await fetch(`/${$route}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                result = data;
                statusOk = true;

            } else {
                console.error('Error response:', data);

                if (res.status === '404') {
                    throw new Error(data.error || 'Fehler: Es wurden keine Artikel gefunden.');
                } else {
                    throw new Error(data.error || 'Ein Fehler ist aufgetreten.');
                }
            }

        } catch (err) {
            error = err;
            console.log(error)

        } finally {
            loading = false;
            if (statusOk) {
                resolvedTopic = topic
            } 
        }
    }
</script>
<FormSection
    {error}
    {loading}
    {newsSelected}
    {result}
/>

<ResultsVisualization 
    resultData={result} 
    {resolvedTopic}
/>
