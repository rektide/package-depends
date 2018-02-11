#!/usr/bin/env node
"use strict"

var
  esm= require( "@std/esm")( module),
  packageDepends= esm( "./package-depends.js"),
  main= esm( "./main.js")

module.exports= packageDepends.PackageDepends
Object.defineProperties( module.exports, {
	defaults: {
		value: packageDepends.defaults
	},
	main: {
		value: main.default
	}
})

if( require.main=== module){
	main.default()
}
