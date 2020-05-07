const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const expect				= require('chai').expect;
const express				= require('express');

const { RestfulAPI }			= require('../../src/index.js');


function basic_tests () {
    it("should get documentation", async () => {
	const app			= new express();
	const root			= new RestfulAPI({
	    __description__: "Testing",
	    async __get__ () {
		`Get the auto generated documentation`

		return this.documentation();
	    },
	});
	await root.initialization( app );
	const docs			= root.documentation();
	log.silly("Result: %s", JSON.stringify(docs,null,4) );

	expect( docs["/"]		).to.be.a("object");
	expect( docs["/"].description	).to.equal("Testing");
	expect( docs["/"].methods.GET	).to.equal("Get the auto generated documentation");
    });
}

describe("RestfulAPI", () => {

    describe("Basic", basic_tests );

});
