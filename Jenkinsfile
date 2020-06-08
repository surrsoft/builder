@Library('pipeline') _

def version = '20.4100'

node ('controls') {
    checkout_pipeline("20.4100/builder/stand_build")
    run_branch = load '/home/sbis/jenkins_pipeline/platforma/branch/run_branch'
    run_branch.execute('builder', version)
}