# This dockerfile will create a docker image for an official release
FROM nimbus16.llnl.gov:8443/default/nimbus-jupyterlab:latest

# Get local packaged files to build extension from
COPY local_package /home/jovyan
COPY sample_data /home/jovyan

# Install Conda packages
ARG conda_channels="-c cdat/label/nightly -c conda-forge"
ARG conda_packages="pip vcs mesalib tqdm nodejs 'python=3.7' jupyterlab jupyterhub ipywidgets 'numpy=1.17'"
RUN conda config --set channel_priority strict
RUN conda install --force -y ${conda_channels} ${conda_packages}
RUN conda clean -y --all

# Install pip packages
RUN python -m pip install sidecar || pip install sidecar

# Install JupyterLab extensions
RUN jupyter labextension install @jupyter-widgets/jupyterlab-manager --no-build
RUN jupyter labextension install @jupyter-widgets/jupyterlab-sidecar --no-build
RUN jupyter labextension install jupyterlab-tutorial-extension --no-build
RUN jupyter labextension install @jupyterlab/hub-extension --no-build

# Our extension needs to be built from npm repo otherwise jupyter-lab
# tries to write into image and shifter does not let us do this.
USER root
RUN jupyter labextension install .
USER jovyan