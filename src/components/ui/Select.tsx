// ponytail: Radix UI Select 原语 + Kimi CSS 变量定制。作为项目组件库基调。
// 后续组件遵循同一模式：Radix 无样式原语 + global.css 里的 .ui-* 类。
import {
  Root,
  Trigger,
  Value,
  Portal,
  Content,
  Viewport,
  Item,
  ItemText,
  ItemIndicator,
  type SelectProps,
  type SelectItemProps,
} from "@radix-ui/react-select";

export function Select({ children, ...props }: SelectProps) {
  return (
    <Root {...props}>
      <Trigger className="ui-select-trigger">
        <Value />
        <span className="ui-select-chevron" aria-hidden="true">⌄</span>
      </Trigger>
      <Portal>
        <Content className="ui-select-content" position="popper" sideOffset={6} align="start">
          <Viewport className="ui-select-viewport">{children}</Viewport>
        </Content>
      </Portal>
    </Root>
  );
}

export function SelectItem({ children, ...props }: SelectItemProps) {
  return (
    <Item className="ui-select-item" {...props}>
      <ItemText>{children}</ItemText>
      <ItemIndicator className="ui-select-indicator" aria-hidden="true">✓</ItemIndicator>
    </Item>
  );
}
