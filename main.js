import PackageDepends from "./package-depends.js"

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
