import { describe, it, expect } from 'vitest';
import { getRoleRank, roleAtLeast, ROLE_HIERARCHY } from './index';

describe('Role Hierarchy', () => {
  it('should correctly order roles from lowest to highest privilege', () => {
    expect(ROLE_HIERARCHY).toEqual([
      'auditor',
      'employee',
      'team_lead',
      'manager',
      'finance_manager',
      'owner',
    ]);
  });

  it('should return correct numeric rank for each role', () => {
    expect(getRoleRank('auditor')).toBe(0);
    expect(getRoleRank('employee')).toBe(1);
    expect(getRoleRank('team_lead')).toBe(2);
    expect(getRoleRank('manager')).toBe(3);
    expect(getRoleRank('finance_manager')).toBe(4);
    expect(getRoleRank('owner')).toBe(5);
  });

  describe('roleAtLeast', () => {
    it('should return true when user role equals required role', () => {
      expect(roleAtLeast('manager', 'manager')).toBe(true);
    });

    it('should return true when user role is higher than required role', () => {
      expect(roleAtLeast('owner', 'manager')).toBe(true);
      expect(roleAtLeast('finance_manager', 'employee')).toBe(true);
    });

    it('should return false when user role is lower than required role', () => {
      expect(roleAtLeast('employee', 'manager')).toBe(false);
      expect(roleAtLeast('auditor', 'owner')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(roleAtLeast('auditor', 'owner')).toBe(false);
      expect(roleAtLeast('owner', 'auditor')).toBe(true);
    });
  });
});
