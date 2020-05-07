const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const assert				= require('assert');
const methods				= require('methods');


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
    assert( methods.includes( method_name.toLowerCase() ),
	    `Unsupported HTTP method ${method_name}, supported methods are ${methods.join(', ')}` );

    return function ( app, handler ) {
	assert( handler[Symbol.toStringTag] === "AsyncFunction",
		      `Request handler must be an async function.  If it returns a Promise, set the function's 'Symbol.toStringTag' to "AsyncFunction"` );

	const model			= this;

	log.debug("Defining app endpoint: %s %s", method_name, this.path );
	app[ method_name ]( this.path, async function ( req, res, raise ) {
	    let result;
	    try {
		req.perform		= ( middleware ) => {
		    return new Promise((f,r) => middleware.call(app, req, res, f));
		};
		result			= await handler.call( model, req, res );
	    } catch ( err ) {
		return raise( err );
	    }

	    if ( result === undefined )
		return res.jsonStatus(
		    500, "Response Undefined",
		    "The request finished without errors, but the response is undefined."
		);

	    res.json( result );
	});
    };
}

const directives			= {
    "get": 		register_method( "get" ),
    "post": 		register_method( "post" ),
    "put": 		register_method( "put" ),
    "delete": 		register_method( "delete" ),
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
		Object.assign( descendants, m.paths() );
	}
	return descendants;
    }

    documentation ( recursive = false ) {
	const documentation		= {};
	const routes			= this.paths( recursive );

	log.debug("Collecting documentation for %s routes", Object.keys(routes).length );
	for ( let [path, model] of Object.entries(routes) ) {
	    const info			= documentation[path] = {
		"description": model._directives.description || null,
		"methods": {},
	    };

	    Object.entries(model._directives)
		.filter( ([_,v]) => typeof v === "function" )
		.map( ([k,v]) => {
		    let name		= k.toUpperCase();
		    info.methods[name]	= v.docstring;
		});
	}
	return documentation;
    }
}


module.exports				= {
    RestfulAPI,
};
