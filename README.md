# Mr. Paint  

[Mr. Paint](https://mrpaint.ink/) is a web-based [collaborative](https://en.wikipedia.org/wiki/Collaborative_editing) [raster image](https://en.wikipedia.org/wiki/Raster_graphics) editor, offering a UI and tooling similar to [Microsoft Paint](https://en.wikipedia.org/wiki/Microsoft_Paint).  

With Mr. Paint, users can make edits to the canvas and have those edits synchronize across all users in real time.  

# Technology  

Mr. Paint does not use [CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)—at least not in a traditional way. Traditional CRDTs excel at handling localized edits, like modifying a single token or inserting a word (e.g., "hello"). However, operations like [flood fill](https://en.wikipedia.org/wiki/Flood_fill) require knowledge of the entire canvas state, making them non-local. This poses a challenge when integrating CRDTs into an image editor.  

To solve global changes such as flood fill, Mr. Paint utilizes a technique similar to [rollback netcode](https://en.wikipedia.org/wiki/Rollback_netcode). Mr. Paint periodically takes snapshots of the canvas, storing metadata about when each snapshot was created. When an older change arrives, the program rolls back to the relevant snapshot and replays all subsequent changes, ensuring consistency.  

# Usage

The website is currently hosted by onrender and can be accessed here: [Mr. Paint](https://mrpaint.ink/)

The session can be shared with others using the URL. The three words after the generic URL are vital for collaborating on the same canvas. 

Stay tuned for more updates to come with additonal tools and features to be added soon!


# Run your own server instance
To build your server you will need Node.js. 

The server will be exposed on port 3000 or 'PORT' in your .env

Run:

npm install

npm run server
