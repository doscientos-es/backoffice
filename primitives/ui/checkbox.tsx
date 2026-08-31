'use client'

import {
  Checkbox as SharedCheckbox,
  type CheckboxProps as SharedCheckboxProps,
} from '@doscientos/ui'

type CheckboxProps = Omit<
  SharedCheckboxProps,
  'defaultSelected' | 'isIndeterminate' | 'isSelected' | 'onChange'
> & {
  checked?: boolean | 'indeterminate'
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

/** Maps the legacy backoffice state prop names onto the shared Checkbox. */
function Checkbox({ checked, defaultChecked, onCheckedChange, ...props }: CheckboxProps) {
  return (
    <SharedCheckbox
      {...props}
      defaultSelected={defaultChecked}
      isIndeterminate={checked === 'indeterminate'}
      isSelected={typeof checked === 'boolean' ? checked : undefined}
      onChange={onCheckedChange}
    />
  )
}

export { Checkbox, type CheckboxProps }
