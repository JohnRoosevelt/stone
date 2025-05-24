<script>
	import { showId } from "$lib";
	import { linear } from "svelte/easing";

	let { src, title, lyricsDataSrc, onended } = $props();

	let clientHeight = $state(0);

	let time = $state(0);
	let duration = $state(0);
	let paused = $state(true);

	function format(time) {
		if (isNaN(time)) return "...";

		const hours = Math.floor(time / 3600);
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);

		return `${hours > 0 ? `${hours}:` : ``}${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
	}

	let lyricsData = $state([]);
	$effect(async () => {
		const res = await fetch(lyricsDataSrc);
		lyricsData = await res.json();
	});

	let activeLine = $state();
	$effect(() => {
		activeLine = lyricsData.findIndex((line, i) => {
			if (time >= line.t) {
				if (i === lyricsData.length - 1) {
					return true;
				}

				if (time < lyricsData[i + 1].t) {
					return true;
				}
			}
		});
	});

	$effect(() => {
		showId(`line${activeLine}`);
	});
</script>

<audio
	autoplay="false"
	{src}
	bind:currentTime={time}
	bind:duration
	bind:paused
	{onended}
></audio>

<article w-full h-full bind:clientHeight>
	<section pt-8 pb-24 style:height="{clientHeight}px" scroll-y space-y-4>
		{#each lyricsData as { t, c }, i}
			<p flex-cc id="line{i}">
				<button
					onclick={() => {
						time = t;
					}}
					transition300
					class:scale-110={activeLine == i}
					class:font-700={activeLine == i}
					class:text-green={activeLine == i}>{c}</button
				>
			</p>
		{/each}
	</section>
</article>

<section w-full h-16 absolute bottom-0>
	<div
		w-full
		h-full
		relative
		class="player select-none flex-bc gap-4 px-4 py-2"
		class:paused
	>
		<div
			absolute
			top-0
			left-0
			w-full
			h-1
			overflow-hidden
			style="background: var(--bg-2, gray)"
			onpointerdown={(e) => {
				const div = e.currentTarget;

				function seek(e) {
					const { left, width } = div.getBoundingClientRect();

					let p = (e.clientX - left) / width;
					if (p < 0) p = 0;
					if (p > 1) p = 1;

					time = p * duration;
				}

				seek(e);

				window.addEventListener("pointermove", seek);

				window.addEventListener(
					"pointerup",
					() => {
						window.removeEventListener("pointermove", seek);
					},
					{
						once: true,
					},
				);
			}}
		>
			<div
				h-full
				style="--progress: {time /
					duration}%; width: calc(100 * var(--progress)); background: var(--bg-3, green);"
			></div>
		</div>

		<div flex-1>
			<p>
				<span font-900>
					{title}
				</span>

				<span>
					<span>{format(time)}</span>
					<span>{duration ? format(duration) : "--:--"}</span>
				</span>
			</p>
		</div>

		<button
			class="play"
			text-7
			aria-label={paused ? "play" : "pause"}
			onclick={() => (paused = !paused)}
		>
			<span i-carbon={paused ? "play" : "pause"}></span>
		</button>

		<button text-7 aria-label="next" onclick={() => (paused = !paused)}>
			<span i-carbon-arrow-right></span>
		</button>
	</div>
</section>

<style>
	.player {
		background: var(--bg-1, black);
		color: var(--fg-3, gray);
	}

	.player:not(.paused) {
		color: var(--fg-1, white);
		filter: drop-shadow(0.5em 0.5em 1em rgba(0, 0, 0, 1));
	}
</style>
