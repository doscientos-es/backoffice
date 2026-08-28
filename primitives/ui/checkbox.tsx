"use client";

import { Checkbox as SharedCheckbox, type CheckboxProps as SharedCheckboxProps } from "@doscientos/ui";

type CheckboxProps = Omit<
  SharedCheckboxProps,
  "defaultSelected" | "isIndeterminate" | "isSelected" | "onChange"
> & {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/** @deprecated Migrate consumers to the state props exported by `@doscientos/ui`. */
function Checkbox({ checked, defaultChecked, onCheckedChange, ...props }: CheckboxProps) {
  return (
    <SharedCheckbox
      {...props}
      defaultSelected={defaultChecked}
      isIndeterminate={checked === "indeterminate"}
      isSelected={typeof checked === "boolean" ? checked : undefined}
      onChange={onCheckedChange}
    />
  );
}

export { Checkbox, type CheckboxProps };
