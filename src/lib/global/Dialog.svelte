<script>
	let {
		open = $bindable(false),
		children,
		autoClose = true,
		animate = {},
	} = $props();

	function show(dialog) {
		function handleClick(event) {
			event.stopPropagation();

			if (open && event.target == dialog && autoClose) {
				open = false;
			}
		}

		$effect(async () => {
			if (open) {
				dialog.showModal();
				await setAnimate(dialog);
				document.body.style.overflow = "hidden";
				document.addEventListener("click", handleClick);
			} else {
				await setAnimate(dialog, false);
				dialog.close();
				document.body.style.overflow = "";
				document.removeEventListener("click", handleClick);
			}
		});
	}

	async function setAnimate(dialog, isIn = true) {
		const child = Array.from(dialog.children)[0];
		for (let [key, value] of Object.entries(animate)) {
			child.style[key] = value[isIn ? 0 : 1];
		}

		child.style.transition = `all 300ms ease-${isIn ? "in-out" : "in-out"}`;

		for (let [key, value] of Object.entries(animate)) {
			child.style[key] = value[isIn ? 1 : 0];
		}
		return new Promise((resove) => {
			setTimeout(resove, 300);
		});
	}
</script>

<dialog overflow="visible" use:show bg="transparent" m="auto">
	{@render children?.()}
</dialog>

<style>
	dialog::backdrop {
		background: black;
		transition: all 300ms ease-in-out;
	}

	dialog[open]::backdrop {
		opacity: 0.6;
	}

	dialog:not([open])::backdrop {
		opacity: 0;
	}
</style>
