// ponytail: jsdom 缺少 ResizeObserver,Radix UI 组件(compose-refs/use-size)需要
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
