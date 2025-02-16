// @flow
import invariant from "invariant";
import type { Account, TokenAccount, Operation } from "../types";

// by convention, a main account is the top level account
// in case of an Account is the account itself
// in case of a TokenAccount it's the parentAccount
export const getMainAccount = (
  account: Account | TokenAccount,
  parentAccount: ?Account
): Account => {
  const mainAccount = account.type === "Account" ? account : parentAccount;
  invariant(mainAccount, "an account is expected");
  return mainAccount;
};

export const getAccountCurrency = (account: Account | TokenAccount) =>
  account.type === "Account" ? account.currency : account.token;

export const getAccountUnit = (account: Account | TokenAccount) =>
  account.type === "Account" ? account.unit : account.token.units[0];

export const isAccountEmpty = (a: Account | TokenAccount): boolean =>
  a.operations.length === 0 && a.balance.isZero();

// clear account to a bare minimal version that can be restored via sync
// will preserve the balance to avoid user panic
export function clearAccount<T: Account | TokenAccount>(account: T): T {
  if (account.type === "TokenAccount") {
    return {
      ...account,
      operations: [],
      pendingOperations: []
    };
  }

  return {
    ...account,
    lastSyncDate: new Date(0),
    operations: [],
    pendingOperations: [],
    tokenAccounts:
      account.tokenAccounts && account.tokenAccounts.map(clearAccount)
  };
}

export function flattenAccounts(
  topAccounts: Account[] | TokenAccount[] | (Account | TokenAccount)[]
): (Account | TokenAccount)[] {
  const accounts = [];
  for (let i = 0; i < topAccounts.length; i++) {
    const account = topAccounts[i];
    accounts.push(account);
    if (account.type === "Account") {
      const tokenAccounts = account.tokenAccounts || [];
      for (let j = 0; j < tokenAccounts.length; j++) {
        accounts.push(tokenAccounts[j]);
      }
    }
  }
  return accounts;
}

const appendPendingOp = (ops: Operation[], op: Operation) => {
  const filtered: Operation[] = ops.filter(
    o => o.transactionSequenceNumber === op.transactionSequenceNumber
  );
  filtered.push(op);
  return filtered;
};

export const addPendingOperation = (account: Account, operation: Operation) => {
  const accountCopy = { ...account };
  const { subOperations } = operation;
  const { tokenAccounts } = account;
  if (subOperations && tokenAccounts) {
    const taCopy: TokenAccount[] = tokenAccounts.slice(0);
    subOperations.forEach(op => {
      const acc = taCopy.find(ta => ta.id === op.accountId);
      if (acc) {
        taCopy[taCopy.indexOf(acc)] = {
          ...acc,
          pendingOperations: appendPendingOp(acc.pendingOperations, op)
        };
      }
    });
    accountCopy.tokenAccounts = taCopy;
  }
  accountCopy.pendingOperations = appendPendingOp(
    accountCopy.pendingOperations,
    operation
  );
  return accountCopy;
};
