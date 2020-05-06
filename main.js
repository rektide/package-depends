#!/usr/bin/env node
import PackageDepends from "./package-depends.js"
import isMain from "is-main"

export async function main( target){
	process.on( "unhandledRejection", console.error)
	process.on( "uncaughtException", console.error)

	target= target|| process.argv[2]|| process.cwd()

	var instance= new PackageDepends({ base: target, trim: true})
	for await( var dep of instance.depends()){
		console.log( dep)
	}
}
export default main

if( isMain( import.meta.url)){
	main()
}
