import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../modules/hooks";
import { useEngine } from "../contexts/EngineContext";
import {
  selectModulesState,
  selectEnvironmentModule,
  selectBoundaryModule,
  selectCollisionsModule,
  selectFluidsModule,
  selectBehaviorModule,
  selectSensorsModule,
  selectTrailsModule,
  selectInteractionModule,
  selectParticleModule,
  selectModuleEnabled,
  setModuleEnabled,
  setModuleProperty,
  updateModuleState,
  setEnvironmentGravityStrength,
  setEnvironmentInertia,
  setEnvironmentFriction,
  setEnvironmentDamping,
  setEnvironmentDirection,
  setBoundaryMode,
  setBoundaryRestitution,
  setBoundaryFriction,
  setBoundaryRepelDistance,
  setBoundaryRepelStrength,
  setCollisionsRestitution,
  setInteractionMode,
  setInteractionStrength,
  setInteractionRadius,
  setFluidsInfluenceRadius,
  setFluidsTargetDensity,
  setFluidsPressureMultiplier,
  setFluidsViscosity,
  setFluidsNearPressureMultiplier,
  setFluidsNearThreshold,
  setFluidsEnableNearPressure,
  setFluidsMaxAcceleration,
  setBehaviorWander,
  setBehaviorCohesion,
  setBehaviorAlignment,
  setBehaviorRepulsion,
  setBehaviorChase,
  setBehaviorAvoid,
  setBehaviorSeparation,
  setBehaviorViewRadius,
  setBehaviorViewAngle,
  setSensorDistance,
  setSensorAngle,
  setSensorRadius,
  setSensorThreshold,
  setSensorStrength,
  setSensorFollowValue,
  setSensorFleeValue,
  setSensorColorSimilarityThreshold,
  setSensorFleeAngle,
  setTrailsDecay,
  setTrailsDiffuse,
  resetModules,
  importModuleSettings,
  type ModulesState,
  type BoundaryModuleState,
  type InteractionModuleState,
} from "../modules/modules/slice";

export function useModules() {
  const dispatch = useAppDispatch();

  // Get engine modules
  const {
    environment,
    boundary,
    collisions,
    fluids,
    behavior,
    sensors,
    trails,
    interaction,
  } = useEngine();

  // Get all module states
  const modulesState = useAppSelector(selectModulesState);
  const environmentState = useAppSelector(selectEnvironmentModule);
  const boundaryState = useAppSelector(selectBoundaryModule);
  const collisionsState = useAppSelector(selectCollisionsModule);
  const fluidsState = useAppSelector(selectFluidsModule);
  const behaviorState = useAppSelector(selectBehaviorModule);
  const sensorsState = useAppSelector(selectSensorsModule);
  const trailsState = useAppSelector(selectTrailsModule);
  const interactionState = useAppSelector(selectInteractionModule);
  const particleState = useAppSelector(selectParticleModule);

  // Sync Redux state to engine modules when they change
  useEffect(() => {
    if (environment) {
      environment.setGravityStrength(environmentState.gravityStrength);
      environment.setInertia(environmentState.inertia);
      environment.setFriction(environmentState.friction);
      environment.setDamping(environmentState.damping);
      environment.setGravityDirection?.(
        environmentState.dirX === 0 && environmentState.dirY === 1
          ? "down"
          : environmentState.dirX === 0 && environmentState.dirY === -1
          ? "up"
          : environmentState.dirX === -1 && environmentState.dirY === 0
          ? "left"
          : environmentState.dirX === 1 && environmentState.dirY === 0
          ? "right"
          : ("custom" as any)
      );
    }
  }, [environment, environmentState]);

  useEffect(() => {
    if (boundary) {
      boundary.setMode(boundaryState.mode as any);
      boundary.setRestitution(boundaryState.restitution);
      boundary.setFriction(boundaryState.friction);
      boundary.setRepelDistance(boundaryState.repelDistance);
      boundary.setRepelStrength(boundaryState.repelStrength);
    }
  }, [boundary, boundaryState]);

  useEffect(() => {
    if (collisions) {
      collisions.setRestitution(collisionsState.restitution);
    }
  }, [collisions, collisionsState]);

  useEffect(() => {
    if (fluids) {
      fluids.setInfluenceRadius(fluidsState.influenceRadius);
      fluids.setTargetDensity(fluidsState.targetDensity);
      fluids.setPressureMultiplier(fluidsState.pressureMultiplier);
      fluids.setViscosity(fluidsState.viscosity);
      fluids.setNearPressureMultiplier(fluidsState.nearPressureMultiplier);
      fluids.setNearThreshold(fluidsState.nearThreshold);
      fluids.setEnableNearPressure(fluidsState.enableNearPressure);
      fluids.setMaxAcceleration(fluidsState.maxAcceleration);
    }
  }, [fluids, fluidsState]);

  useEffect(() => {
    if (behavior) {
      behavior.setWander(behaviorState.wander);
      behavior.setCohesion(behaviorState.cohesion);
      behavior.setAlignment(behaviorState.alignment);
      behavior.setRepulsion(behaviorState.repulsion);
      behavior.setChase(behaviorState.chase);
      behavior.setAvoid(behaviorState.avoid);
      behavior.setSeparation(behaviorState.separation);
      behavior.setViewRadius(behaviorState.viewRadius);
      behavior.setViewAngle(behaviorState.viewAngle);
    }
  }, [behavior, behaviorState]);

  useEffect(() => {
    if (sensors) {
      sensors.setSensorDistance(sensorsState.sensorDistance);
      sensors.setSensorAngle(sensorsState.sensorAngle);
      sensors.setSensorRadius(sensorsState.sensorRadius);
      sensors.setSensorThreshold(sensorsState.sensorThreshold);
      sensors.setSensorStrength(sensorsState.sensorStrength);
      sensors.setFollowBehavior(sensorsState.followValue as any);
      sensors.setFleeBehavior(sensorsState.fleeValue as any);
      sensors.setColorSimilarityThreshold(
        sensorsState.colorSimilarityThreshold
      );
      sensors.setFleeAngle(sensorsState.fleeAngle);
    }
  }, [sensors, sensorsState]);

  useEffect(() => {
    if (trails) {
      trails.setTrailDecay(trailsState.trailDecay);
      trails.setTrailDiffuse(trailsState.trailDiffuse);
    }
  }, [trails, trailsState]);

  useEffect(() => {
    if (interaction) {
      interaction.setMode(interactionState.mode);
      interaction.setStrength(interactionState.strength);
      interaction.setRadius(interactionState.radius);
    }
  }, [interaction, interactionState]);

  // Generic module actions
  const setModuleEnabledAction = useCallback(
    (module: keyof ModulesState, enabled: boolean) => {
      dispatch(setModuleEnabled({ module, enabled }));
    },
    [dispatch]
  );

  const setModulePropertyAction = useCallback(
    (module: keyof ModulesState, property: string, value: any) => {
      dispatch(setModuleProperty({ module, property, value }));
    },
    [dispatch]
  );

  const updateModuleStateAction = useCallback(
    (module: keyof ModulesState, updates: Partial<any>) => {
      dispatch(updateModuleState({ module, updates }));
    },
    [dispatch]
  );

  // Environment module actions
  const setEnvironmentGravityStrengthAction = useCallback(
    (value: number) => {
      dispatch(setEnvironmentGravityStrength(value));
      environment?.setGravityStrength(value);
    },
    [dispatch, environment]
  );

  const setEnvironmentInertiaAction = useCallback(
    (value: number) => {
      dispatch(setEnvironmentInertia(value));
      environment?.setInertia(value);
    },
    [dispatch, environment]
  );

  const setEnvironmentFrictionAction = useCallback(
    (value: number) => {
      dispatch(setEnvironmentFriction(value));
      environment?.setFriction(value);
    },
    [dispatch, environment]
  );

  const setEnvironmentDampingAction = useCallback(
    (value: number) => {
      dispatch(setEnvironmentDamping(value));
      environment?.setDamping(value);
    },
    [dispatch, environment]
  );

  const setEnvironmentDirectionAction = useCallback(
    (dirX: number, dirY: number) => {
      dispatch(setEnvironmentDirection({ dirX, dirY }));
      const direction =
        dirX === 0 && dirY === 1
          ? "down"
          : dirX === 0 && dirY === -1
          ? "up"
          : dirX === -1 && dirY === 0
          ? "left"
          : dirX === 1 && dirY === 0
          ? "right"
          : ("custom" as any);
      environment?.setGravityDirection?.(direction);
    },
    [dispatch, environment]
  );

  // Boundary module actions
  const setBoundaryModeAction = useCallback(
    (mode: BoundaryModuleState["mode"]) => {
      dispatch(setBoundaryMode(mode));
      boundary?.setMode(mode as any);
    },
    [dispatch, boundary]
  );

  const setBoundaryRestitutionAction = useCallback(
    (value: number) => {
      dispatch(setBoundaryRestitution(value));
      boundary?.setRestitution(value);
    },
    [dispatch, boundary]
  );

  const setBoundaryFrictionAction = useCallback(
    (value: number) => {
      dispatch(setBoundaryFriction(value));
      boundary?.setFriction(value);
    },
    [dispatch, boundary]
  );

  const setBoundaryRepelDistanceAction = useCallback(
    (value: number) => {
      dispatch(setBoundaryRepelDistance(value));
      boundary?.setRepelDistance(value);
    },
    [dispatch, boundary]
  );

  const setBoundaryRepelStrengthAction = useCallback(
    (value: number) => {
      dispatch(setBoundaryRepelStrength(value));
      boundary?.setRepelStrength(value);
    },
    [dispatch, boundary]
  );

  // Collisions module actions
  const setCollisionsRestitutionAction = useCallback(
    (value: number) => {
      dispatch(setCollisionsRestitution(value));
      collisions?.setRestitution(value);
    },
    [dispatch, collisions]
  );

  // Interaction module actions
  const setInteractionModeAction = useCallback(
    (mode: InteractionModuleState["mode"]) => {
      dispatch(setInteractionMode(mode));
      interaction?.setMode(mode);
    },
    [dispatch, interaction]
  );

  const setInteractionStrengthAction = useCallback(
    (value: number) => {
      dispatch(setInteractionStrength(value));
      interaction?.setStrength(value);
    },
    [dispatch, interaction]
  );

  const setInteractionRadiusAction = useCallback(
    (value: number) => {
      dispatch(setInteractionRadius(value));
      interaction?.setRadius(value);
    },
    [dispatch, interaction]
  );

  // Fluids module actions
  const setFluidsInfluenceRadiusAction = useCallback(
    (value: number) => {
      dispatch(setFluidsInfluenceRadius(value));
      fluids?.setInfluenceRadius(value);
    },
    [dispatch, fluids]
  );

  const setFluidsTargetDensityAction = useCallback(
    (value: number) => {
      dispatch(setFluidsTargetDensity(value));
      fluids?.setTargetDensity(value);
    },
    [dispatch, fluids]
  );

  const setFluidsPressureMultiplierAction = useCallback(
    (value: number) => {
      dispatch(setFluidsPressureMultiplier(value));
      fluids?.setPressureMultiplier(value);
    },
    [dispatch, fluids]
  );

  const setFluidsViscosityAction = useCallback(
    (value: number) => {
      dispatch(setFluidsViscosity(value));
      fluids?.setViscosity(value);
    },
    [dispatch, fluids]
  );

  const setFluidsNearPressureMultiplierAction = useCallback(
    (value: number) => {
      dispatch(setFluidsNearPressureMultiplier(value));
      fluids?.setNearPressureMultiplier(value);
    },
    [dispatch, fluids]
  );

  const setFluidsNearThresholdAction = useCallback(
    (value: number) => {
      dispatch(setFluidsNearThreshold(value));
      fluids?.setNearThreshold(value);
    },
    [dispatch, fluids]
  );

  const setFluidsEnableNearPressureAction = useCallback(
    (value: boolean) => {
      dispatch(setFluidsEnableNearPressure(value));
      fluids?.setEnableNearPressure(value);
    },
    [dispatch, fluids]
  );

  const setFluidsMaxAccelerationAction = useCallback(
    (value: number) => {
      dispatch(setFluidsMaxAcceleration(value));
      fluids?.setMaxAcceleration(value);
    },
    [dispatch, fluids]
  );

  // Behavior module actions
  const setBehaviorWanderAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorWander(value));
      behavior?.setWander(value);
    },
    [dispatch, behavior]
  );

  const setBehaviorCohesionAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorCohesion(value));
      behavior?.setCohesion(value);
    },
    [dispatch, behavior]
  );

  const setBehaviorAlignmentAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorAlignment(value));
      behavior?.setAlignment(value);
    },
    [dispatch, behavior]
  );

  const setBehaviorRepulsionAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorRepulsion(value));
      behavior?.setRepulsion(value);
    },
    [dispatch, behavior]
  );

  const setBehaviorChaseAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorChase(value));
      behavior?.setChase(value);
    },
    [dispatch, behavior]
  );

  const setBehaviorAvoidAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorAvoid(value));
      behavior?.setAvoid(value);
    },
    [dispatch, behavior]
  );

  const setBehaviorSeparationAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorSeparation(value));
      behavior?.setSeparation(value);
    },
    [dispatch, behavior]
  );

  const setBehaviorViewRadiusAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorViewRadius(value));
      behavior?.setViewRadius(value);
    },
    [dispatch, behavior]
  );

  const setBehaviorViewAngleAction = useCallback(
    (value: number) => {
      dispatch(setBehaviorViewAngle(value));
      behavior?.setViewAngle(value);
    },
    [dispatch, behavior]
  );

  // Sensors module actions
  const setSensorDistanceAction = useCallback(
    (value: number) => {
      dispatch(setSensorDistance(value));
      sensors?.setSensorDistance(value);
    },
    [dispatch, sensors]
  );

  const setSensorAngleAction = useCallback(
    (value: number) => {
      dispatch(setSensorAngle(value));
      sensors?.setSensorAngle(value);
    },
    [dispatch, sensors]
  );

  const setSensorRadiusAction = useCallback(
    (value: number) => {
      dispatch(setSensorRadius(value));
      sensors?.setSensorRadius(value);
    },
    [dispatch, sensors]
  );

  const setSensorThresholdAction = useCallback(
    (value: number) => {
      dispatch(setSensorThreshold(value));
      sensors?.setSensorThreshold(value);
    },
    [dispatch, sensors]
  );

  const setSensorStrengthAction = useCallback(
    (value: number) => {
      dispatch(setSensorStrength(value));
      sensors?.setSensorStrength(value);
    },
    [dispatch, sensors]
  );

  const setSensorFollowValueAction = useCallback(
    (value: string) => {
      dispatch(setSensorFollowValue(value));
      sensors?.setFollowBehavior(value as any);
    },
    [dispatch, sensors]
  );

  const setSensorFleeValueAction = useCallback(
    (value: string) => {
      dispatch(setSensorFleeValue(value));
      sensors?.setFleeBehavior(value as any);
    },
    [dispatch, sensors]
  );

  const setSensorColorSimilarityThresholdAction = useCallback(
    (value: number) => {
      dispatch(setSensorColorSimilarityThreshold(value));
      sensors?.setColorSimilarityThreshold(value);
    },
    [dispatch, sensors]
  );

  const setSensorFleeAngleAction = useCallback(
    (value: number) => {
      dispatch(setSensorFleeAngle(value));
      sensors?.setFleeAngle(value);
    },
    [dispatch, sensors]
  );

  // Trails module actions
  const setTrailsDecayAction = useCallback(
    (value: number) => {
      dispatch(setTrailsDecay(value));
      trails?.setTrailDecay(value);
    },
    [dispatch, trails]
  );

  const setTrailsDiffuseAction = useCallback(
    (value: number) => {
      dispatch(setTrailsDiffuse(value));
      trails?.setTrailDiffuse(value);
    },
    [dispatch, trails]
  );

  // Utility actions
  const resetModulesAction = useCallback(() => {
    dispatch(resetModules());
  }, [dispatch]);

  const importModuleSettingsAction = useCallback(
    (settings: Partial<ModulesState>) => {
      dispatch(importModuleSettings(settings));
    },
    [dispatch]
  );

  // Module enabled selectors
  const isEnvironmentEnabled = useAppSelector(
    selectModuleEnabled("environment")
  );
  const isBoundaryEnabled = useAppSelector(selectModuleEnabled("boundary"));
  const isCollisionsEnabled = useAppSelector(selectModuleEnabled("collisions"));
  const isFluidsEnabled = useAppSelector(selectModuleEnabled("fluids"));
  const isBehaviorEnabled = useAppSelector(selectModuleEnabled("behavior"));
  const isSensorsEnabled = useAppSelector(selectModuleEnabled("sensors"));
  const isTrailsEnabled = useAppSelector(selectModuleEnabled("trails"));
  const isInteractionEnabled = useAppSelector(
    selectModuleEnabled("interaction")
  );
  const isParticleEnabled = useAppSelector(selectModuleEnabled("particle"));

  return {
    // State values (getters)
    modulesState,
    environmentState,
    boundaryState,
    collisionsState,
    fluidsState,
    behaviorState,
    sensorsState,
    trailsState,
    interactionState,
    particleState,

    // Module enabled flags
    isEnvironmentEnabled,
    isBoundaryEnabled,
    isCollisionsEnabled,
    isFluidsEnabled,
    isBehaviorEnabled,
    isSensorsEnabled,
    isTrailsEnabled,
    isInteractionEnabled,
    isParticleEnabled,

    // Generic module actions
    setModuleEnabled: setModuleEnabledAction,
    setModuleProperty: setModulePropertyAction,
    updateModuleState: updateModuleStateAction,

    // Environment module actions
    setEnvironmentGravityStrength: setEnvironmentGravityStrengthAction,
    setEnvironmentInertia: setEnvironmentInertiaAction,
    setEnvironmentFriction: setEnvironmentFrictionAction,
    setEnvironmentDamping: setEnvironmentDampingAction,
    setEnvironmentDirection: setEnvironmentDirectionAction,

    // Boundary module actions
    setBoundaryMode: setBoundaryModeAction,
    setBoundaryRestitution: setBoundaryRestitutionAction,
    setBoundaryFriction: setBoundaryFrictionAction,
    setBoundaryRepelDistance: setBoundaryRepelDistanceAction,
    setBoundaryRepelStrength: setBoundaryRepelStrengthAction,

    // Collisions module actions
    setCollisionsRestitution: setCollisionsRestitutionAction,

    // Interaction module actions
    setInteractionMode: setInteractionModeAction,
    setInteractionStrength: setInteractionStrengthAction,
    setInteractionRadius: setInteractionRadiusAction,

    // Fluids module actions
    setFluidsInfluenceRadius: setFluidsInfluenceRadiusAction,
    setFluidsTargetDensity: setFluidsTargetDensityAction,
    setFluidsPressureMultiplier: setFluidsPressureMultiplierAction,
    setFluidsViscosity: setFluidsViscosityAction,
    setFluidsNearPressureMultiplier: setFluidsNearPressureMultiplierAction,
    setFluidsNearThreshold: setFluidsNearThresholdAction,
    setFluidsEnableNearPressure: setFluidsEnableNearPressureAction,
    setFluidsMaxAcceleration: setFluidsMaxAccelerationAction,

    // Behavior module actions
    setBehaviorWander: setBehaviorWanderAction,
    setBehaviorCohesion: setBehaviorCohesionAction,
    setBehaviorAlignment: setBehaviorAlignmentAction,
    setBehaviorRepulsion: setBehaviorRepulsionAction,
    setBehaviorChase: setBehaviorChaseAction,
    setBehaviorAvoid: setBehaviorAvoidAction,
    setBehaviorSeparation: setBehaviorSeparationAction,
    setBehaviorViewRadius: setBehaviorViewRadiusAction,
    setBehaviorViewAngle: setBehaviorViewAngleAction,

    // Sensors module actions
    setSensorDistance: setSensorDistanceAction,
    setSensorAngle: setSensorAngleAction,
    setSensorRadius: setSensorRadiusAction,
    setSensorThreshold: setSensorThresholdAction,
    setSensorStrength: setSensorStrengthAction,
    setSensorFollowValue: setSensorFollowValueAction,
    setSensorFleeValue: setSensorFleeValueAction,
    setSensorColorSimilarityThreshold: setSensorColorSimilarityThresholdAction,
    setSensorFleeAngle: setSensorFleeAngleAction,

    // Trails module actions
    setTrailsDecay: setTrailsDecayAction,
    setTrailsDiffuse: setTrailsDiffuseAction,

    // Utility actions
    resetModules: resetModulesAction,
    importModuleSettings: importModuleSettingsAction,
  };
}
