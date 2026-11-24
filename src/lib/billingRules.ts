export const SWITCH_OFF_STATUSES = ['tdc'];
export const ZERO_AMOUNT_STATUSES = ['tdc', 'dc'];

export function shouldSwitchBeOff(status: string): boolean {
  if (!status) return false;
  return SWITCH_OFF_STATUSES.includes(String(status).toLowerCase().trim());
}

export function shouldZeroAmount(status: string): boolean {
  if (!status) return false;
  return ZERO_AMOUNT_STATUSES.includes(String(status).toLowerCase().trim());
}
