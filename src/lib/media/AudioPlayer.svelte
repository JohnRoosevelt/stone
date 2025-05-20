<script>
	let { src, title, artist, onended } = $props();

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
</script>

<div class="player" class:paused>
	<audio
		autoplay
		{src}
		bind:currentTime={time}
		bind:duration
		bind:paused
		{onended}
	></audio>

	<button
		class="play"
		text-7
		aria-label={paused ? "play" : "pause"}
		onclick={() => (paused = !paused)}
	>
		<span i-carbon={paused ? "play" : "pause"}></span>
	</button>

	<div class="info">
		<div class="description">
			<strong>{title}</strong> /
			<span text-green>{artist}</span>
		</div>

		<div class="time">
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

	<button text-7 aria-label="setting" onclick={() => console.log("setting")}>
		<span i-carbon-menu></span>
	</button>

	<button text-7 aria-label="setting" onclick={() => console.log("setting")}>
		<span i-carbon-time></span>
	</button>
</div>

<style>
	.player {
		display: grid;
		grid-template-columns: 2.5em 1fr 2.5em 2.5em;
		align-items: center;
		gap: 1em;
		padding: 0.5em 1em 0.5em 0.5em;
		/* border-radius: 2em; */
		background: var(--bg-1, black);
		transition: filter 0.2s;
		color: var(--fg-3, red);
		user-select: none;
	}

	.player:not(.paused) {
		color: var(--fg-1, white);
		filter: drop-shadow(0.5em 0.5em 1em rgba(0, 0, 0, 0.1));
	}

	button {
		width: 100%;
		aspect-ratio: 1;
		background-repeat: no-repeat;
		background-position: 50% 50%;
		border-radius: 50%;
	}

	.info {
		overflow: hidden;
	}

	.description {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.2;
	}

	.time {
		display: flex;
		align-items: center;
		gap: 0.5em;
	}

	.time span {
		font-size: 0.7em;
	}

	.slider {
		flex: 1;
		height: 0.5em;
		background: var(--bg-2, gray);
		border-radius: 0.5em;
		overflow: hidden;
	}

	.progress {
		width: calc(100 * var(--progress));
		height: 100%;
		background: var(--bg-3, green);
	}
</style>
