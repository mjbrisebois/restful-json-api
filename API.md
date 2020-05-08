# Javascript API

## `new RestfulAPI( config )`
Create a RestfulAPI configuration.

```javascript
const restful = new RestfulAPI({
    __description__ = "This is a forum API",
    async __get__ () {
        `Get API documentation`
        return this.documentation( true );
    },
    "posts": {
        __description__ = "Users create posts",
        async __get__( req, res ) {
            `Get a list of posts that belong to a user`
            ...get post list
        },
        async __post__( req, res ) {
            `Create a new post`
            ...create post
        },
        ":id": {
            __description__ = "Manage a post",
            async __get__( req, res ) {
                `Get a single post`
                ...get post
            },
            async __put__( req, res ) {
                `Replace all post details`
                ...update post
            },
            async __patch__( req, res ) {
                `Update given post details`
                ...partial update post
            },
            async __delete__( req, res ) {
                `Delete post`
                ...delete post
            },
        },
    },
    "comments": {
        __description__ = "Comments belong to posts",
        ":id": {
            __description__ = "Manage a comment",
            async __get__( req, res ) {
                `Get a single comment`
                ...get comment list
            },
            async __put__( req, res ) {
                `Replace all comment details`
                ...update comment
            },
            async __patch__( req, res ) {
                `Update given comment details`
                ...partial update comment
            },
            async __delete__( req, res ) {
                `Delete comment`
                ...delete comment
            },
        },
    },
});
```

### `.initialization( app ) -> Promise<null>`
Runs each directives setup procedure for this instance and all descendants.  Returns when all
directives have finished their configuration.

Example
```javascript
const app = express();
await restful.initialization( app );
```

### `.children() -> object`
Returns an object that contains the children defined for this path.

Example
```javascript
{
    "posts": RestfulAPI {},
    "comments": RestfulAPI {},
}
```

### `.paths( recursive = false ) -> object`
Same as `.children()` but the child keys are set to the full path rather than the child's path
segement.

When recursive is true, all the descendant's paths will also be added.

Example
```javascript
{
    "/posts": RestfulAPI {},
    "/comments": RestfulAPI {},
}
```

### `.documentation( recursive = false ) -> object`
Returns an object where the keys are the children's paths and the value is information collected
from directives.

When recursive is true, all the descendant's documentation will also be added.

Example
```javascript
{
    ...
    "/posts": {
        "description": "Users create posts",
        "methods": {
            "GET": "Get a list of posts that belong to a user",
            "POST": "Create a new post"
        }
    },
    ...
}
```


# Supported Directives

- **`__description__`** - `string` for describing a resource
- **`__get__.call( RestfulAPI, req, res )`** - `async function` for handling HTTP `GET` requests
- **`__head__.call( RestfulAPI, req, res )`** - `async function` for handling HTTP `HEAD` requests
- **`__post__.call( RestfulAPI, req, res )`** - `async function` for handling HTTP `POST` requests
- **`__put__.call( RestfulAPI, req, res )`** - `async function` for handling HTTP `PUT` requests
- **`__patch__.call( RestfulAPI, req, res )`** - `async function` for handling HTTP `PATCH` requests
- **`__delete__.call( RestfulAPI, req, res )`** - `async function` for handling HTTP `DELETE` requests
- **`__options__.call( RestfulAPI, req, res )`** - `async function` for handling HTTP `OPTIONS` requests

## Directives vs Children
Since directives and children reside in the same object, it is important that there be a
deterministic way to tell them apart.

- Directives start and end with 2 underscores `__` (eg. `__<directive name>__`).
- Children are everything else.  Children keys map to URL path segments so they cannot contain any
  path terminating characters (eg. `?`, `#`, or `/`).

### Examples
Example of the `description` directive
```javascript
{
    __description__ = "This describes a resource"
}
```

Example of the `get` directive
```javascript
{
    async __get__ () {
        return this.documentation( true );
    }
}
```
