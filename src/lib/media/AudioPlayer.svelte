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

	$effect(() => {
		lyricsData.forEach((line, i) => {
			const nextLine = lyricsData[i + 1];
			if (nextLine) {
				if (time >= line.start && time < nextLine.start) {
					showId(`line${i}`);
				}
				return;
			}

			if (time >= line.start) {
				showId(`line${i}`);
			}
		});
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
		{#each lyricsData as { start, c }, i}
			<p flex-cc id="line{i}">
				<button
					onclick={() => {
						time = start;
					}}
					class:text-green={lyricsData[i + 1]
						? time >= start && time < lyricsData[i + 1].start
						: time > start}>{c}</button
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
			h-2px
			overflow-hidden
			style="background: var(--bg-2, gray)"
		>
			<div
				h-full
				style="--progress: {time /
					duration}%; width: calc(100 * var(--progress)); background: var(--bg-3, green);"
			></div>
		</div>

		<div flex-1>
			<div class="description">
				<p font-900>{title}</p>
			</div>

			<div hidden class="time">
				<span>{format(time)}</span>
				<div
					class="slider"
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
					<div class="progress" style="--progress: {time / duration}%"></div>
				</div>
				<span>{duration ? format(duration) : "--:--"}</span>
			</div>
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
