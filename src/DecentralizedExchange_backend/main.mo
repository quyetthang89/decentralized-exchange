import Debug "mo:base/Debug";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Option "mo:base/Option";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import TrieMap "mo:base/TrieMap";
import Text "mo:base/Text";
import Map "mo:motoko-hash-map/Map";

import TokenA "canister:token_a";
import TokenB "canister:token_b";

import ICRC "./ICRC";

actor class Swapper() = this {

  // Track the deposited per-user balances for token A and token B
  private var balancesA = TrieMap.TrieMap<Principal, Nat>(Principal.equal, Principal.hash);
  private var balancesB = TrieMap.TrieMap<Principal, Nat>(Principal.equal, Principal.hash);

  private stable var stableBalancesA : ?[(Principal, Nat)] = null;
  private stable var stableBalancesB : ?[(Principal, Nat)] = null;

  type SwapRequestPayload = {
    amount : Nat;
    fromToken : Text;
    toToken : Text;
  };

  type SwapRequest = SwapRequestPayload and {
    id : Nat;
    creator : Principal;
  };

  let { nhash } = Map;

  stable let swapRequests = Map.new<Nat, SwapRequest>();
  stable var nextSwapRequestId : Nat = 1;

  public type SwapError = {
    #SwapRequestNotFound;
    #InsufficientFunds;
    #OutdatedSwapRequest;
  };

  public shared ({ caller }) func createSwapRequest(swapRequest : SwapRequestPayload) : async Result.Result<(), SwapError> {
    let { fromToken; toToken } = swapRequest;
    assert (fromToken == "A" or fromToken == "B");
    assert (toToken == "A" or toToken == "B");
    assert (fromToken != toToken);

    let balances = which_balances(swapRequest.fromToken);
    let balance = Option.get(balances.get(caller), 0 : Nat);

    if (balance < swapRequest.amount) {
      return #err(#InsufficientFunds);
    };

    let newSwapRequest : SwapRequest = {
      swapRequest with
      id = nextSwapRequestId;
      creator = caller;
    };
    Map.set(swapRequests, nhash, nextSwapRequestId, newSwapRequest);
    nextSwapRequestId += 1;

    return #ok(());
  };

  public query func listSwapRequest() : async [SwapRequest] {
    return Iter.toArray(Map.vals(swapRequests));
  };

  public shared ({ caller }) func acceptSwapRequest(swapRequestId : Nat) : async Result.Result<(), SwapError> {
    switch (Map.get(swapRequests, nhash, swapRequestId)) {
      case (?swapRequest) {
        // Check for sufficient balance
        let { amount } = swapRequest;

        let fromBalances = which_balances(swapRequest.fromToken);
        let fromBalance = Option.get(fromBalances.get(swapRequest.creator), 0 : Nat);

        let toBalances = which_balances(swapRequest.toToken);
        let toBalance = Option.get(toBalances.get(caller), 0 : Nat);

        if (fromBalance < amount) {
          ignore Map.remove(swapRequests, nhash, swapRequestId);
          return #err(#OutdatedSwapRequest);
        };

        if (toBalance < amount) {
          return #err(#InsufficientFunds);
        };
        // Perform the swap
        fromBalances.put(
          swapRequest.creator,
          fromBalance - amount,
        );
        fromBalances.put(
          caller,
          Option.get(fromBalances.get(caller), 0 : Nat) + amount,
        );
        toBalances.put(
          caller,
          toBalance - amount,
        );
        toBalances.put(
          swapRequest.creator,
          Option.get(toBalances.get(swapRequest.creator), 0 : Nat) + amount,
        );

        ignore Map.remove(swapRequests, nhash, swapRequestId);
        return #ok(());
      };
      case null { #err(#SwapRequestNotFound) };
    };
  };

  public type DepositError = {
    #TransferFromError : ICRC.TransferFromError;
  };

  // Accept deposits
  public shared ({ caller }) func deposit(tokenSymbol : Text, amount : Nat) : async Result.Result<Nat, DepositError> {
    let token = which_ledger(tokenSymbol);
    let balances = which_balances(tokenSymbol);

    // Perform the transfer, to capture the tokens.
    let transfer_result = await token.icrc2_transfer_from({
      spender_subaccount = null;
      from = { owner = caller; subaccount = null };
      to = { owner = Principal.fromActor(this); subaccount = null };
      amount;
      fee = null;
      memo = null;
      created_at_time = null;
    });

    // Check that the transfer was successful.
    let block_height = switch (transfer_result) {
      case (#Ok(block_height)) { block_height };
      case (#Err(err)) {
        return #err(#TransferFromError(err));
      };
    };

    // Credit the sender's account
    let old_balance = Option.get(balances.get(caller), 0 : Nat);
    balances.put(caller, old_balance + amount);

    // Return the "block height" of the transfer
    #ok(block_height);
  };

  public type WithdrawError = {
    // The caller doesn't not have sufficient funds deposited in this swap
    // contract to fulfil this withdrawal.
    #InsufficientFunds : { balance : ICRC.Tokens };
    // For other transfer errors, we can just wrap and return them.
    #TransferError : ICRC.TransferError;
  };

  // Allow withdrawals
  public shared ({ caller }) func withdraw(tokenSymbol : Text, amount : Nat) : async Result.Result<Nat, WithdrawError> {
    let token = which_ledger(tokenSymbol);
    let balances = which_balances(tokenSymbol);

    let fee = await token.icrc1_fee();

    // Check the user's balance is sufficient
    let old_balance = Option.get(balances.get(caller), 0 : Nat);
    if (old_balance < amount + fee) {
      return #err(#InsufficientFunds { balance = old_balance });
    };

    // Debit the sender's account
    let new_balance = old_balance - amount - fee;
    if (new_balance == 0) {
      // Delete zero-balances to keep the balance table tidy.
      balances.delete(caller);
    } else {
      balances.put(caller, new_balance);
    };

    // Perform the transfer, to send the tokens.
    let transfer_result = await token.icrc1_transfer({
      from_subaccount = null;
      to = { owner = caller; subaccount = null };
      amount = amount;
      fee = null;
      memo = null;
      created_at_time = null;
    });

    // Check that the transfer was successful.
    let block_height = switch (transfer_result) {
      case (#Ok(block_height)) { block_height };
      case (#Err(err)) {
        // The transfer failed, we need to refund the user's account (less
        // fees), so that they do not completely lose their tokens, and can
        // retry the withdrawal.
        let b = Option.get(balances.get(caller), 0 : Nat);
        balances.put(caller, b + amount + fee);

        return #err(#TransferError(err));
      };
    };

    // Return the "block height" of the transfer
    #ok(block_height);
  };

  public shared ({ caller }) func getBalance(tokenSymbol : Text) : async Nat {
    let balances = which_balances(tokenSymbol);
    return Option.get(balances.get(caller), 0 : Nat);
  };

  // which_balances checks which token we are withdrawing
  private func which_balances(tokenSymbol : Text) : TrieMap.TrieMap<Principal, Nat> {
    switch (tokenSymbol) {
      case "A" { balancesA };
      case "B" { balancesB };
      case _ { Debug.trap("invalid token") };
    };
  };

  private func which_ledger(tokenSymbol : Text) : ICRC.Actor {
    switch (tokenSymbol) {
      case "A" { TokenA };
      case "B" { TokenB };
      case _ { Debug.trap("invalid token") };
    };
  };

  system func preupgrade() {
    stableBalancesA := ?Iter.toArray(balancesA.entries());
    stableBalancesB := ?Iter.toArray(balancesB.entries());
  };

  system func postupgrade() {
    switch (stableBalancesA) {
      case (null) {};
      case (?entries) {
        balancesA := TrieMap.fromEntries<Principal, Nat>(entries.vals(), Principal.equal, Principal.hash);
        stableBalancesA := null;
      };
    };

    switch (stableBalancesB) {
      case (null) {};
      case (?entries) {
        balancesB := TrieMap.fromEntries<Principal, Nat>(entries.vals(), Principal.equal, Principal.hash);
        stableBalancesB := null;
      };
    };
  };

};
