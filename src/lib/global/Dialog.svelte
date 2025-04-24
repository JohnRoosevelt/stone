<script>
	import { delay } from "$lib";

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

		$effect(() => {
			animate;
			// console.log('dialog animate chage');
			setAnimate(dialog, false);
		});

		$effect(async () => {
			if (open) {
				// console.log("dialog open");
				dialog.showModal();
				setAnimate(dialog);
				document.body.style.overflow = "hidden";
				document.addEventListener("click", handleClick);
				return;
			}

			if (!dialog.open) {
				// console.log("dialog init");
				setAnimate(dialog, false);
				return;
			}

			// console.log("dialog close");
			setAnimate(dialog, false);
			await delay(300);
			dialog.close();
			document.body.style.overflow = "";
			document.removeEventListener("click", handleClick);
		});
	}

	function setAnimate(dialog, isIn = true) {
		const child = Array.from(dialog.children)[0];
		if (!child) return;
		for (let [key, value] of Object.entries(animate)) {
			child.style[key] = value[isIn ? 0 : 1];
		}

		child.style.transition = `all 300ms ease-${isIn ? "in-out" : "in-out"}`;

		for (let [key, value] of Object.entries(animate)) {
			child.style[key] = value[isIn ? 1 : 0];
		}
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
