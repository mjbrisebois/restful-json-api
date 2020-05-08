![](https://img.shields.io/npm/v/@whi/restful-json-api/latest?style=flat-square)

# Restful JSON API
A tool for rapid restful API development.

![](https://img.shields.io/github/issues-raw/mjbrisebois/restful-json-api?style=flat-square)
![](https://img.shields.io/github/issues-closed-raw/mjbrisebois/restful-json-api?style=flat-square)
![](https://img.shields.io/github/issues-pr-raw/mjbrisebois/restful-json-api?style=flat-square)

## Overview


### Features

- `async/await` syntax for deterministic response
- Automatic `404`, `405`, and `501` responses
- Strict and specific misconfiguration errors for rapid development
- Detailed error types using `@whi/serious-error-types`
- Flexible directive structure
- Derived API documentation

### Directives vs Children
Since directives and children reside in the same object, it is important that there be a
deterministic way to tell them apart.

- Directives start and end with 2 underscores `__` (eg. `__<directive name>__`).
- Children are everything else.  Children keys map to URL path segments so they cannot contain any
  path terminating characters (eg. `?`, `#`, or `/`).

#### Examples
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


## Usage

### Install
```bash
npm install @whi/restful-json-api
```

### Import
```javascript
const { RestfulAPI } = require('@whi/restful-json-api');
```

### Javascript API
[API.md](./API.md)

## Automatic Assistants

### 404 Not Found
Automatically returned when

- the endpoint has been defined
- and, the request method is not defined
- and, the request method is GET or HEAD

HTTP specification states that servers must support GET and HEAD methods.  So instead of 405 or 501
we return a 404 to indicate that the endpoint is valid but empty.

### 405 Method Not Allowed
Automatically returned when

- the endpoint has been defined
- and, the request method is supported by this server
- but, this endpoint does not support that request method

It will return the "Allow" header with the endpoint's supported request methods because 405
responses must include the "Allow" header.

### 501 Not Implemented
Automatically returned when

- the endpoint has been defined
- but, the request method is not supported by this server
