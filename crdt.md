The Mr. Paint CRDT Spec defines a data transfer protocol for a collaborative pixel image editor.
# Transaction
- A transaction represents an edit to the image. 
- A transaction has the property than a collection of them produces the same image regardless the order of the collection
- The max length of a transaction is (2^32 + 15) Bytes or ~4 Gigabytes

Structure of data:
- 10 Bytes: [[Mr. Paint CRDT#TOUUID|TOUUID]]
- 1 Bytes: [[Mr. Paint CRDT#Transaction Type|Transaction Type]]
- 4 Bytes (optional): Unsigned 32 bit Integer - Length specifier for variable types
- N Bytes: Transaction Parameters
# TOUUID
A time ordered universally unique identifier (TOUUID) represents a unique event at a specific time.
A TOUUID has the property that one later in time has a larger binary value than one which is earlier.
This spec depreciates on **June 4, 2318 6:57:57.760 AM GMT**.
There is a **97.1%** chance of no collision happening between 2 TOUUIDs created 10 times every second for 100 years.

Structure of data:
- 5 Bytes: Number of centiseconds since **January 1, 1970 12:00:00 AM GMT**
- 5 Bytes: 40 random bits

# Transaction Type
Pencil structure of data:
- 3 Bytes: Color
- 2 Bytes: Brush Size
- 4 Bytes: Spline start control
- 4 Bytes: Spline start
- 4 Bytes: Spline end
- 4 Bytes: Spline end control

# Generating an image from a collection transactions
To generate an image from a collection of transactions:
1. Sort the transactions on binary value.
2. Iterate over the transactions starting from the earliest.
	1. Apply transaction to the canvas

# Generating an image from a stream of Transactions
Generating an image from a stream of transactions requires a more sophisticated algorithm than the collection case because you can't simply sort the incoming stream of data. We will still assume that the transactions received will be close to the current time for efficiency however we will not assume a limit to how earlier in time a transaction was created.

The main optimization to the algorithm is an exponential snapshot which stores previous image states. When a transaction is received which occurred prior to our current state, we insert that new transaction into our sorted history and find the latest snapshot which happened before that received transaction. From this snapshot we process all the transaction after the snapshot as a sequential order of canvas edits and since we previously added the received transaction it will be slipped in naturally. 

```
INITIAL STATE
snapshot                                        current
transaction transaction transaction transaction

ADD RECEIVED TRANSACTION
snapshot                                                    current
transaction transaction transaction transaction transaction
                        ^ New

PROCESS FROM SNAPSHOT
snapshot->  process     process     process     process     new current
transaction transaction transaction transaction transaction
                        ^ New
```

The exponential aspect optimizes the space used for the snapshot system. Essentially as transactions are processed we store every ith canvas as a snapshot. That stored state gets handled by a system which tracks it's age and based on that age either moves it up in the list of snapshots or removes it. The end result of this system is a list of snapshots where each snapshot is approximately i times further in the past than the one before. 

By using this exponential system only log_i(n) snapshots need to be stored and guarantees that a transaction that happens k transactions in the past takes at most i * k transactions to process and on average (1+i)/2 * k transactions.

```
CASE i = 2 where snapshot1 is the current state

state_1    snapshot1  snapshot2  shapshot 4
state_2
state_3
state_4
state_5

state_2    snapshot1  snapshot2  shapshot 4
state_3    state_1
state_4    age_1
state_5

state_3    snapshot1  snapshot2  shapshot 4 ; notice how state 1 moves forward
state_4    state_2    state_1               ; because of it's age
state_5    age_1      age_2


state_4    snapshot1  snapshot2  shapshot 4
state_5    state_3    state_2    state_1
           age_1      age_2      age_3

state_5    snapshot1  snapshot2  shapshot 4 ; notice how state 2 got removed
           state_4    state_3    state_1    ; because snapshot_4 was taken
           age_1      age_2      age_4

           snapshot1  snapshot2  shapshot 4 
           state_5    state_4    state_3        
           age_1      age_2      age_3
```

