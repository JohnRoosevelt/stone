<script>
    import { page } from "$app/state";
    const { data } = $props();

</script>

<ul>
    <li font-700>
        <p>{data.user.name}</p>
    </li>
    <li font-500>
        <p>{data.channel.name}</p>
    </li>
    {#each data.channel.playlist as { name }, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li onclick={() => {
            const id = `${page.params.uid - 0 + 1}_${page.params.channelId - 0 + 1}_${i+1}`
            console.log(i, id, name)
        }}>
           <a href="./{page.params.channelId}/{i}">{name}</a>
        </li>
    {/each}
</ul>