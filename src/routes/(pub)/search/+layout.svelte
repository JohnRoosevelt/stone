<script>
  /**
   * 搜索布局壳
   *
   * 作为 /search 和 /search/results 的共享父级，
   * 切换子路由时状态保留不销毁。
   */
  const { children } = $props();
</script>

{@render children()}
