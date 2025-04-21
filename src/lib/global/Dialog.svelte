<script>
	let { open = $bindable(false), children, autoClose = true } = $props();

	function show(dialog) {
		const handleClick = (event) => {
			event.stopPropagation();

			if (open && event.target == dialog && autoClose) {
				open = false;
			}
		};

		$effect(() => {
			if (open) {
				dialog.showModal();
				document.body.style.overflow = "hidden";
				document.addEventListener("click", handleClick);
			} else {
				dialog.close();
				document.body.style.overflow = "";
				document.removeEventListener("click", handleClick);
			}
		});
	}

	function slideFromBottom(node, { duration = 300 }) {
		return {
			duration,
			css: (t) => {
				const eased = cubicOut(t);
				return `
          transform: translateY(${(1 - eased) * 100}%); 
          opacity: ${eased};
        `;
			},
		};
	}

	function slideToBottom(node, { duration = 300 }) {
		return {
			duration,
			css: (t) => {
				const eased = cubicOut(t);
				return `
          transform: translateY(${(1 - eased) * -100}%); 
          opacity: ${eased};
        `;
			},
		};
	}
</script>

<!-- in:slideFromBottom={{ duration: 500 }}
      out:slideToBottom={{ duration: 500 }} -->
<dialog overflow="visible" use:show bg="transparent" m="auto">
	{@render children?.()}
</dialog>

<style>
	::backdrop {
		background: black;
		backdrop-filter: blur(70px);
		box-shadow: 0 3px 5px rgba(0, 0, 0, 0.3);
		opacity: 0.6;
	}
</style>
