<script>
    import { page } from "$app/state";
    const { data } = $props();
</script>

<ul>
    <li font-700>
        <p>{data.user.name}</p>
    </li>
    {#each data.user.channel as { name }, i}
        <li>
            <a block href="./{page.params.uid}/{i}">{name}</a>
        </li>
    {/each}
</ul>
