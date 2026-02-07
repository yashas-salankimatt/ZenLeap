// ZenLeapAgentParent.sys.mjs — Minimal parent actor for ZenLeapAgent
// Required for actor registration; all logic lives in the child.

export class ZenLeapAgentParent extends JSWindowActorParent {
  receiveMessage(message) {
    // Parent receives no messages — all queries go parent→child via sendQuery.
  }
}
