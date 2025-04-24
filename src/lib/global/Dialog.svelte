<script>
	import { DATAS } from "$lib/data.svelte";
	import DialogMeta from "./DialogMeta.svelte";

	const animate = $derived.by(() => {
		const rz = {
			opacity: [0, 1],
			...DATAS.dialog.animate,
		};

		let transform;

		switch (DATAS.dialog.p) {
			case "l":
				transform = [`translateX(-100%)`, "translateX(0)"];
				break;

			case "r":
				transform = [`translateX(100%)`, "translateX(0)"];
				break;

			case "b":
				transform = ["translateY(100%)", "translateY(0)"];
				break;

			case "t":
				transform = ["translateY(-100%)", "translateY(0)"];
				break;

			default:
				break;
		}

		if (transform) {
			rz.transform = transform;
		}

		return rz;
	});

	const C = $derived(DATAS.dialog.c);
</script>

<DialogMeta bind:open={DATAS.dialog.show} {animate}>
	{#if ["l", "r"].includes(DATAS.dialog.p)}
		{@render RX()}
	{:else if ["t", "b"].includes(DATAS.dialog.p)}
		{@render RY()}
	{:else}
		{@render RC()}
	{/if}
</DialogMeta>

{#snippet RC()}
	<C />
{/snippet}

{#snippet RX()}
	<article
		fixed
		inset-0
		bg="white"
		w="80vw"
		h-screen
		class:rounded-r-4={DATAS.dialog.p === "l"}
		class:rounded-l-4={DATAS.dialog.p === "r"}
		class:ml-20vw={DATAS.dialog.p === "r"}
		overflow-hidden
	>
		<C />
	</article>
{/snippet}

{#snippet RY()}
	<article
		bg="white dark:black"
		fixed
		class:bottom-0={DATAS.dialog.p === "b"}
		class:rounded-t-4={DATAS.dialog.p === "b"}
		class:top-0={DATAS.dialog.p === "t"}
		class:rounded-b-4={DATAS.dialog.p === "t"}
		left-0
		w-screen
		min-h-30
		max-h="[calc(100vh-120px)]"
		scroll-y
		p-4
		flex-cc
	>
		<C />
	</article>
{/snippet}
