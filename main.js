import PackageDepends from "./package-depends.js"

var
  target= process.argv[2]|| process.cwd(),
  instance= new PackageDepends( target)

export async function main(){
	for await( var dep of instance){
		console.log({dep})
	}
}
export default main
