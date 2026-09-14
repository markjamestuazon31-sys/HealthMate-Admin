import {
  ArrowForwardRounded,
  GroupsOutlined,
  HealthAndSafetyOutlined,
  MapRounded,
  PriorityHighOutlined,
  SupportAgentOutlined,
} from "@mui/icons-material";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { alpha } from "@mui/material/styles";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import EmergencyChart from "../components/dashboard/EmergencyChart";
import RecentEmergencyTable from "../components/dashboard/RecentEmergencyTable";
import StatCard from "../components/dashboard/StatCard";

import EmergencyAvatar from "../components/emergency/EmergencyAvatar";

import {
  EmergencyPriorityChip,
  isTerminalStatus,
} from "../components/emergency/EmergencyStatusChip";

import { useAuth } from "../context/AuthContext";

import {
  listenEmergencies,
} from "../services/emergencyService";

import {
  listenResponders,
} from "../services/responderService";

import {
  listenUsers,
} from "../services/userService";

import type {
  Emergency,
  Responder,
  User,
} from "../types";

/*
 * Unified HealthMate administrator palette.
 *
 * These colors match the emergency/SOS visual identity
 * requested for the administrator portal.
 */
const HM_RED = "#D92D20";
const HM_RED_DARK = "#B42318";
const HM_RED_DEEP = "#7A271A";
const HM_RED_LIGHT = "#F97066";
const HM_RED_SOFT = "#FFF1F0";

export default function Dashboard() {
  const navigate = useNavigate();

  const {
    adminProfile,
    dispatchWarning,
  } = useAuth();

  const [
    emergencies,
    setEmergencies,
  ] = useState<Emergency[]>([]);

  const [
    users,
    setUsers,
  ] = useState<User[]>([]);

  const [
    responders,
    setResponders,
  ] = useState<Responder[]>([]);

  useEffect(() => {
    const unsubscribeEmergencies =
      listenEmergencies(
        setEmergencies,
      );

    const unsubscribeUsers =
      listenUsers(
        setUsers,
      );

    const unsubscribeResponders =
      listenResponders(
        setResponders,
      );

    return () => {
      unsubscribeEmergencies();
      unsubscribeUsers();
      unsubscribeResponders();
    };
  }, []);

  const active =
    useMemo(
      () =>
        emergencies.filter(
          (item) =>
            !isTerminalStatus(
              item.status,
            ),
        ),
      [emergencies],
    );

  const highPriority =
    useMemo(
      () =>
        active.filter(
          (item) =>
            item.priority ===
              "HIGH" ||
            item.priority ===
              "CRITICAL",
        ).length,
      [active],
    );

  const residentCount =
    useMemo(
      () =>
        users.filter(
          (item) =>
            !item.role ||
            item.role === "user" ||
            item.role ===
              "resident",
        ).length,
      [users],
    );

  const availableResponders =
    useMemo(
      () =>
        responders.filter(
          (item) =>
            item.availability ===
              "AVAILABLE" &&
            item.accountStatus ===
              "active",
        ).length,
      [responders],
    );

  const topIncident =
    active[0];

  return (
    <Stack spacing={3}>
      {/* Command center header */}
      <Paper
        sx={{
          p: {
            xs: 2.5,
            md: 3.5,
          },

          color:
            "common.white",

          overflow:
            "hidden",

          position:
            "relative",

          background:
            `linear-gradient(
              120deg,
              ${HM_RED_DEEP} 0%,
              ${HM_RED_DARK} 52%,
              ${HM_RED} 100%
            )`,

          boxShadow:
            "0 18px 45px rgba(122, 39, 26, 0.18)",

          "&::before": {
            content: '""',
            position:
              "absolute",
            width: 360,
            height: 360,
            borderRadius:
              "50%",
            right: -130,
            top: -220,
            bgcolor:
              alpha(
                "#FFFFFF",
                0.08,
              ),
          },

          "&::after": {
            content: '""',
            position:
              "absolute",
            width: 220,
            height: 220,
            borderRadius:
              "50%",
            right: 120,
            bottom: -170,
            bgcolor:
              alpha(
                "#FFFFFF",
                0.055,
              ),
          },
        }}
      >
        <Stack
          direction={{
            xs: "column",
            lg: "row",
          }}
          spacing={3}
          justifyContent="space-between"
          alignItems={{
            lg: "center",
          }}
          sx={{
            position:
              "relative",
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              maxWidth: 760,
            }}
          >
            <Typography
              variant="overline"
              sx={{
                color:
                  alpha(
                    "#FFFFFF",
                    0.74,
                  ),
                fontWeight: 900,
                letterSpacing: 1.35,
              }}
            >
              HealthMate command center
            </Typography>

            <Typography
              variant="h3"
              color="inherit"
              sx={{
                mt: 0.25,
                letterSpacing: -1.4,
              }}
            >
              Good day,{" "}
              {adminProfile
                ?.fullName
                ?.split(" ")[0] ||
                "Administrator"}
            </Typography>

            <Typography
              sx={{
                color:
                  alpha(
                    "#FFFFFF",
                    0.82,
                  ),
                mt: 1,
                lineHeight: 1.7,
              }}
            >
              Monitor mobile SOS
              incidents, verify
              patient identity and
              live location, and
              coordinate respondents
              from one real-time
              operations workspace.
            </Typography>

            {dispatchWarning && (
              <Chip
                label={
                  dispatchWarning
                }
                sx={{
                  mt: 2,
                  maxWidth:
                    "100%",
                  bgcolor:
                    alpha(
                      "#FFFFFF",
                      0.16,
                    ),
                  color:
                    "#FFFFFF",
                  border:
                    `1px solid ${alpha(
                      "#FFFFFF",
                      0.3,
                    )}`,
                  fontWeight:
                    800,
                }}
              />
            )}
          </Box>

          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={1.25}
          >
            <Button
              variant="contained"
              startIcon={
                <HealthAndSafetyOutlined />
              }
              onClick={() =>
                navigate(
                  "/emergencies",
                )
              }
              sx={{
                bgcolor:
                  "#FFFFFF",
                color:
                  HM_RED_DARK,

                "&:hover": {
                  bgcolor:
                    "#FFF5F4",
                },
              }}
            >
              Open incidents
            </Button>

            <Button
              variant="outlined"
              startIcon={
                <MapRounded />
              }
              onClick={() =>
                navigate(
                  "/map",
                )
              }
              sx={{
                color:
                  "#FFFFFF",

                borderColor:
                  alpha(
                    "#FFFFFF",
                    0.58,
                  ),

                "&:hover": {
                  borderColor:
                    "#FFFFFF",

                  bgcolor:
                    alpha(
                      "#FFFFFF",
                      0.1,
                    ),
                },
              }}
            >
              Live map
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Statistics */}
      <Box
        sx={{
          display: "grid",

          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            xl: "repeat(4, 1fr)",
          },

          gap: 2,
        }}
      >
        <StatCard
          title="Active emergencies"
          value={active.length}
          helper="Needs monitoring"
          icon={
            <HealthAndSafetyOutlined />
          }
          color={
            HM_RED
          }
        />

        <StatCard
          title="High or critical"
          value={highPriority}
          helper="Immediate attention"
          icon={
            <PriorityHighOutlined />
          }
          color={
            HM_RED_DARK
          }
        />

        <StatCard
          title="Registered residents"
          value={residentCount}
          helper="Android user records"
          icon={
            <GroupsOutlined />
          }
          color={
            HM_RED_LIGHT
          }
        />

        <StatCard
          title="Available respondents"
          value={
            availableResponders
          }
          helper={
            `${responders.length} registered`
          }
          icon={
            <SupportAgentOutlined />
          }
          color={
            HM_RED_DEEP
          }
        />
      </Box>

      {/* Most recent SOS */}
      {topIncident && (
        <Paper
          variant="outlined"
          sx={{
            p: {
              xs: 2,
              md: 2.5,
            },

            borderColor:
              alpha(
                HM_RED,
                0.25,
              ),

            bgcolor:
              alpha(
                HM_RED,
                0.035,
              ),

            boxShadow:
              "0 10px 28px rgba(122, 39, 26, 0.06)",
          }}
        >
          <Stack
            direction={{
              xs: "column",
              md: "row",
            }}
            spacing={2}
            alignItems={{
              md: "center",
            }}
          >
            <EmergencyAvatar
              name={
                topIncident.patientName
              }
              profileImage={
                topIncident
                  .patientProfile
                  ?.profileImage
              }
              size={64}
              pulse
            />

            <Box
              sx={{
                flexGrow: 1,
                minWidth: 0,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                alignItems="center"
              >
                <Typography
                  variant="h6"
                >
                  Most recent active
                  SOS
                </Typography>

                <EmergencyPriorityChip
                  priority={
                    topIncident.priority
                  }
                />
              </Stack>

              <Typography
                fontWeight={850}
                sx={{
                  mt: 0.5,
                }}
              >
                {topIncident.patientName ||
                  "Unknown user"}
              </Typography>

              <Typography
                color="text.secondary"
                fontSize={13}
              >
                {topIncident.description}
              </Typography>
            </Box>

            <Button
              variant="contained"
              endIcon={
                <ArrowForwardRounded />
              }
              onClick={() =>
                navigate(
                  `/emergencies/${topIncident.id}`,
                )
              }
              sx={{
                bgcolor:
                  HM_RED,

                color:
                  "#FFFFFF",

                "&:hover": {
                  bgcolor:
                    HM_RED_DARK,
                },
              }}
            >
              Review now
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Charts */}
      <Box
        sx={{
          display: "grid",

          gridTemplateColumns: {
            xs: "1fr",
            xl:
              "minmax(0, 1.15fr) minmax(360px, 0.85fr)",
          },

          gap: 2.5,
        }}
      >
        <Card>
          <CardContent
            sx={{
              p: {
                xs: 2,
                sm: 3,
              },
            }}
          >
            <Typography variant="h6">
              Seven-day SOS trend
            </Typography>

            <Typography
              color="text.secondary"
              fontSize={13}
              sx={{
                mb: 1,
              }}
            >
              Emergency alerts received
              from the Android application
            </Typography>

            <EmergencyChart
              emergencies={
                emergencies
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent
            sx={{
              p: {
                xs: 2,
                sm: 3,
              },
            }}
          >
            <Typography variant="h6">
              Response readiness
            </Typography>

            <Typography
              color="text.secondary"
              fontSize={13}
              sx={{
                mb: 2.5,
              }}
            >
              Current respondent
              availability
            </Typography>

            <Stack spacing={1.5}>
              {(
                [
                  "AVAILABLE",
                  "BUSY",
                  "OFF_DUTY",
                ] as const
              ).map(
                (
                  responseStatus,
                ) => {
                  const count =
                    responders.filter(
                      (item) =>
                        item.availability ===
                        responseStatus,
                    ).length;

                  const tone =
                    responseStatus ===
                    "AVAILABLE"
                      ? HM_RED
                      : responseStatus ===
                          "BUSY"
                        ? HM_RED_DARK
                        : HM_RED_DEEP;

                  return (
                    <Stack
                      key={
                        responseStatus
                      }
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography color="text.secondary">
                        {responseStatus.replace(
                          "_",
                          " ",
                        )}
                      </Typography>

                      <Chip
                        size="small"
                        label={count}
                        sx={{
                          bgcolor:
                            alpha(
                              tone,
                              0.1,
                            ),
                          color:
                            tone,
                          border:
                            `1px solid ${alpha(
                              tone,
                              0.22,
                            )}`,
                          fontWeight:
                            850,
                        }}
                      />
                    </Stack>
                  );
                },
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Recent emergency records */}
      <Box>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            mb: 1.5,
          }}
        >
          <Typography variant="h6">
            Recent emergencies
          </Typography>

          <Button
            endIcon={
              <ArrowForwardRounded />
            }
            onClick={() =>
              navigate(
                "/emergencies",
              )
            }
            sx={{
              color:
                HM_RED_DARK,
            }}
          >
            View all
          </Button>
        </Stack>

        <RecentEmergencyTable
          emergencies={
            emergencies
          }
        />
      </Box>
    </Stack>
  );
}