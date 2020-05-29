const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: (!__dirname.includes("/node_modules/") && process.env.LOG_LEVEL ) || 'fatal',
});

const assert				= require('assert');
const http_methods			= require('methods');

const { HTTPRequestError,
	HTTPResponseError,
	MethodNotAllowedError }		= require('@whi/serious-error-types');


Object.defineProperty(Function.prototype, 'docstring', {
    get: function () {
	let docmatches			= this.toString().match(/^[^{]*\{[\s]*`([\s\S]*?)`/);
	return docmatches ? docmatches[1].trim() : "";;
    }
});


function separate_components ( config ) {
    const methods			= {};
    const children			= {};

    for ( let [name, value] of Object.entries(config) ) {
	if ( name.startsWith("__") && name.endsWith("__") ) {
	    const method_name		= name.slice(2,-2);
	    methods[ method_name ]	= value;
	}
	else
	    children[ name ]		= value;
    }
    return [ methods, children ];
}

function register_method ( method_name ) {
    method_name				= method_name.toLowerCase();
    assert( http_methods.includes( method_name ),
	    `Unsupported HTTP method ${method_name}, supported methods are ${http_methods.join(', ')}` );

    return function ( app, handler ) {
	assert( handler[Symbol.toStringTag] === "AsyncFunction",
		      `Request handler must be an async function.  If it returns a Promise, set the function's 'Symbol.toStringTag' to "AsyncFunction"` );

	const restful			= this;

	if ( restful.methods === undefined )
	    restful.methods		= {};

	log.debug("Defining app endpoint: %s %s", method_name, this.path );
	async function endpoint ( req, res, raise ) {
	    let result;
	    try {
		const draft		= restful.request( req, res, raise );
		result			= await draft.execute( method_name, handler );
	    } catch ( err ) {
		return raise( err );
	    }

	    if ( result === undefined )
		return raise( new HTTPResponseError(
		    500,  "Response Undefined",
		    "The request finished without errors, but the response is undefined."
		));

	    if ( res.get("Content-type").includes("json") )
		res.json( result );
	    else
		res.send( result );
	};
	this.methods[method_name]	= endpoint;
	app[ method_name ]( this.path, endpoint );
    };
}

const directives			= {
    "get": 		register_method( "get" ),
    "post": 		register_method( "post" ),
    "put": 		register_method( "put" ),
    "patch": 		register_method( "patch" ),
    "delete": 		register_method( "delete" ),
    "options": 		register_method( "options" ),
    "description":	() => null,
};

class RestfulAPI {

    middleware_list			= [];

    constructor ( config, path_segment = null, parent = null ) {
	if ( path_segment !== null ) {
	    assert( typeof path_segment === "string",
			  `Path segment must be a string, not type '${typeof path_segment}'` );
	    assert( path_segment.indexOf("/") === -1,
			  `Path segments cannot contain "/" characters, '${path_segment}'` );
	}

	if ( parent === null ) {
	    this.path_segments		= path_segment === null ? [] : [ path_segment ];
	}
	else {
	    assert( parent.constructor === this.constructor,
			  `Parent must be made from ${this.constructor.name}, not ${parent.constructor}` );
	    assert( typeof path_segment === "string",
			  `There must be a path segment (string) if a parent is given, type '${typeof path_segment}' is insufficient` );
	    this.path_segments		= parent.path_segments.concat([ path_segment ]);
	}

	this.parent			= parent;
	this.path_segment		= path_segment;
	this.path			= "/" + this.path_segments.join("/");

	log.debug("Config for %s: %s", this.path, typeof config );

	// If the configuration given is an Array, the expectation is that the config is the last
	// item and all other items are middleware.
	//
	// This would be better satisfied with a __middleware__ like directive, rather than this
	// obscure Array formatting.
	if ( Array.isArray( config ) ) {
	    this.config			= config.pop();
	    this.middleware_list.push( ...config );
	}
	else
	    this.config			= config;

	const [ directives, children ]	= separate_components( this.config );
	log.debug("New instance %-50.50s has %s directives and %s children", this.path,
		  Object.keys(directives).length, Object.keys(children).length );

	for ( let k of Object.keys(children) )
	    children[k]			= new this.constructor( children[k], k, this );

	this._directives		= directives;
	this._children			= children;
    }

    async initialization ( app ) {
	if ( this.middleware_list.length )
	    app.use( this.path, ...this.middleware_list );

	for ( let [cmd, value] of Object.entries(this._directives) ) {
	    await directives[ cmd ].call(this, app, value );
	}

	log.info("Defining 405 catch for path: %s", this.path );
	app.all( this.path, (req, _, next) => {
	    log.silly("Sending proper error response for: %s %s", req.method, req.path );

	    // 404 if the request method was GET or HEAD
	    if ( ["get", "head"].includes( req.method.toLowerCase() ) ) {
		next( new HTTPRequestError( 404, `The requested resource cannot be found` ) );
	    }
	    // 405 if it does not recognize the method
	    else if ( ["post", "put", "patch", "delete", "options"].includes( req.method.toLowerCase() ) ) {
		log.debug("Unsupported method %s @ %s triggered by %s", req.method, this.path, req.path );
		next( new MethodNotAllowedError( this.path, req.method, Object.keys( this.methods )) );
	    }
	    // 501 if it does not support the method
	    else {
		log.debug("Unrecognized method %s @ %s triggered by %s", req.method, this.path, req.path );
		next( new HTTPResponseError( 501 ) );
	    }
	});

	for ( let child of Object.values(this._children) ) {
	    await child.initialization( app );
	}
    }

    children () {
	return Object.assign({}, this._children );
    }

    paths ( recursive = false ) {
	const descendants		= {
	    [this.path]: this,
	};
	for ( let m of Object.values(this._children) ) {
	    descendants[m.path]		= m;

	    if ( recursive === true )
		Object.assign( descendants, m.paths( recursive ) );
	}
	return descendants;
    }

    documentation ( recursive = false ) {
	const documentation		= {};
	const routes			= this.paths( recursive );

	log.debug("Collecting documentation for %s routes", Object.keys(routes).length );
	for ( let [path, restful] of Object.entries(routes) ) {
	    const info			= documentation[path] = {
		"description": restful._directives.description || null,
		"methods": {},
	    };

	    Object.entries(restful._directives)
		.filter( ([_,v]) => typeof v === "function" )
		.map( ([k,v]) => {
		    let name		= k.toUpperCase();
		    info.methods[name]	= v.docstring;
		});
	}
	return documentation;
    }

    request ( req, res ) {
	return new Request( req, res, this );
    }
}


class Request {
    fulfill;
    reject;
    delegation_history			= [];

    constructor ( req, res, restful ) {
	this.request			= req;
	this.response			= res;
	this.restful			= restful;

	this.response.set("Content-type", "application/json");
    }

    execute ( method, handler ) {
	this.delegation_history.push( method );

	return new Promise(async (f,r) => {
	    this.fulfill		= f;
	    this.reject			= r;

	    try {
		const result		= await handler.call(
		    this, this.request, this.response
		);

		if ( this.delegation_history.length === 1 )
		    this.fulfill( result );
	    } catch ( err ) {
		this.reject( err );
	    }
	});
    }

    async delegate ( method ) {
	// check that the method is not the same as this one, otherwise it will be an infinite loop.
	method				= method.toLowerCase();
	if ( this.delegation_history.includes( method ) )
	    return this.reject( new Error(`Delegation loop @ method '${method}', delegation history: ${this.delegation_history.join(" -> ")}`) );

	this.delegation_history.push( method );
	log.info("Delegating request handling to %s", method );
	this.restful._directives[ method ].call( this, this.request, this.response )
	    .then( this.fulfill.bind(this), this.reject.bind(this) );
    }

    // perform ( middleware ) {
    //     return new Promise((f,r) => middleware.call(app, req, res, f));
    // };
}


module.exports				= {
    RestfulAPI,
};
